// ── GitHub Codespaces Client for Kivora ──
// Manages codespace lifecycle and executes code via GitHub Actions
// Auth: GitHub PAT with 'codespace' + 'repo' + 'workflow' scopes
//
// Execution strategy:
//   - Quick tasks: Uses GitHub Actions workflow_dispatch to run code
//   - Dev environments: Creates/manages Codespaces for persistent work
//   - Fallback: When E2B is unavailable, this provides real shell execution

let githubToken = null
let defaultRepository = null // Set via setDefaultRepository()

// ── In-memory cache for auto-created workflow ──
const _workflowEnsured = new Set()

// ── The executor workflow YAML (inline to avoid needing a file in the repo) ──
const EXECUTOR_WORKFLOW_YAML = `name: Kivora Executor
on:
  workflow_dispatch:
    inputs:
      code:
        description: 'Base64-encoded code to execute'
        required: true
      language:
        description: 'Language: bash | python | node'
        required: true
        default: 'bash'
      run_id:
        description: 'Unique run identifier'
        required: true

jobs:
  execute:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Decode and execute
        run: |
          echo "::group::Setup"
          CODE_FILE="/tmp/kivora_code_\${{ inputs.run_id }}"
          echo "\${{ inputs.code }}" | base64 -d > "$CODE_FILE"
          LANG="\${{ inputs.language }}"
          echo "Language: $LANG"
          echo "Run ID: \${{ inputs.run_id }}"
          echo "::endgroup::"

          echo "::group::Execution"
          set +e
          if [ "$LANG" = "python" ]; then
            python3 "$CODE_FILE" 2>&1 | tee /tmp/kivora_output_\${{ inputs.run_id }}.txt
            EXIT_CODE=\${PIPESTATUS[0]}
          elif [ "$LANG" = "node" ]; then
            node "$CODE_FILE" 2>&1 | tee /tmp/kivora_output_\${{ inputs.run_id }}.txt
            EXIT_CODE=\${PIPESTATUS[0]}
          else
            bash "$CODE_FILE" 2>&1 | tee /tmp/kivora_output_\${{ inputs.run_id }}.txt
            EXIT_CODE=\${PIPESTATUS[0]}
          fi
          set -e
          echo "::endgroup::"

          echo "::group::Result"
          echo "exit_code=$EXIT_CODE" >> $GITHUB_OUTPUT
          if [ "$EXIT_CODE" -ne 0 ]; then
            echo "Execution failed with exit code $EXIT_CODE"
            exit $EXIT_CODE
          fi
          echo "Execution succeeded"
          echo "::endgroup::"

      - name: Save result
        if: always()
        run: |
          mkdir -p kivora-results
          cp /tmp/kivora_output_\${{ inputs.run_id }}.txt kivora-results/\${{ inputs.run_id }}.txt 2>/dev/null || echo "(no output)" > kivora-results/\${{ inputs.run_id }}.txt
          echo "\${{ inputs.run_id }}:exit=\${{ steps.decode.outputs.exit_code || '1' }}" >> kivora-results/\${{ inputs.run_id }}.meta.txt

      - name: Commit result
        if: always()
        run: |
          git config user.name "kivora-bot[bot]"
          git config user.email "kivora-bot[bot]@users.noreply.github.com"
          git add kivora-results/ 2>/dev/null || true
          git diff --quiet && git diff --staged --quiet || git commit -m "kivora: result \${{ inputs.run_id }}"
          git push

      - name: Cleanup old results
        if: always()
        run: |
          # Remove result files older than 1 hour to keep the repo clean
          find kivora-results/ -name "*.txt" -mmin +60 -delete 2>/dev/null || true
          git add -A kivora-results/ 2>/dev/null || true
          git diff --quiet && git diff --staged --quiet || git commit -m "kivora: cleanup old results"
          git push || true
`

// ── Credential Management ──

export function setGitHubToken(token) {
  githubToken = token
}

export function setDefaultRepository(repo) {
  defaultRepository = repo
}

export function getDefaultRepository() {
  return defaultRepository
}

export function isCodespacesAvailable() {
  return !!githubToken && !!defaultRepository
}

// ── Internal Helpers ──

async function githubFetch(path, options = {}) {
  if (!githubToken) throw new Error('GitHub token not set')
  const url = path.startsWith('http') ? path : `https://api.github.com${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status}: ${text || res.statusText}`)
  }
  if (res.status === 204) return null // No content
  return res.json()
}

// ── Ensure Executor Workflow ──
// Creates the kivora-executor.yml workflow in the repo if it doesn't exist

async function ensureExecutorWorkflow(repository) {
  if (_workflowEnsured.has(repository)) return

  const workflowPath = '.github/workflows/kivora-executor.yml'

  // Check if it already exists
  try {
    await githubFetch(`/repos/${repository}/contents/${encodeURIComponent(workflowPath)}?ref=main`)
    _workflowEnsured.add(repository)
    return
  } catch {
    // 404 — need to create it
  }

  // Create the workflow file
  const content = typeof btoa !== 'undefined'
    ? btoa(unescape(encodeURIComponent(EXECUTOR_WORKFLOW_YAML)))
    : Buffer.from(EXECUTOR_WORKFLOW_YAML).toString('base64')

  await githubFetch(`/repos/${repository}/contents/${encodeURIComponent(workflowPath)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'kivora: add executor workflow for AI code execution',
      content,
      branch: 'main',
    }),
  })

  // Wait for GitHub to index the workflow (usually takes 5-15 seconds)
  await new Promise(r => setTimeout(r, 10000))
  _workflowEnsured.add(repository)
}

// ── Machine Types ──

export function getCodespaceMachineTypes() {
  return [
    { id: 'standardLinux4gb', name: '2-core · 4GB RAM', vcpus: 2, ram: '4GB', storage: '32GB' },
    { id: 'standardLinux8gb', name: '4-core · 8GB RAM', vcpus: 4, ram: '8GB', storage: '32GB' },
    { id: 'standardLinux16gb', name: '8-core · 16GB RAM', vcpus: 8, ram: '16GB', storage: '32GB' },
    { id: 'standardLinux32gb', name: '16-core · 32GB RAM', vcpus: 16, ram: '32GB', storage: '32GB' },
    { id: 'standardLinux64gb', name: '32-core · 64GB RAM', vcpus: 32, ram: '64GB', storage: '32GB' },
  ]
}

// ── List Codespaces ──

export async function listCodespaces() {
  const data = await githubFetch('/user/codespaces?per_page=30')
  return data?.codespaces || []
}

// ── Create Codespace ──

export async function createCodespace(options = {}) {
  const {
    repositoryId,
    repository,    // "owner/repo" format — will look up ID
    ref = 'main',
    machine = 'standardLinux4gb',
    idleTimeout = 30,
    devcontainerPath,
    location,
  } = options

  let repoId = repositoryId
  if (!repoId && repository) {
    const repo = await githubFetch(`/repos/${repository}`)
    repoId = repo.id
  }
  if (!repoId) throw new Error('repositoryId or repository (owner/repo) required')

  const body = {
    repository_id: repoId,
    ref,
    machine,
    idle_timeout_minutes: idleTimeout,
  }
  if (devcontainerPath) body.devcontainer_path = devcontainerPath
  if (location) body.location = location

  const codespace = await githubFetch('/user/codespaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    name: codespace.name,
    owner: codespace.owner?.login,
    repository: codespace.repository?.full_name,
    status: codespace.state,
    machine: codespace.machine?.displayName,
    webUrl: codespace.web_url,
    idleTimeout: codespace.idle_timeout_minutes,
    createdAt: codespace.created_at,
  }
}

// ── Get Codespace Status ──

export async function getCodespaceStatus(name) {
  const data = await githubFetch(`/user/codespaces/${name}`)
  return {
    name: data.name,
    status: data.state, // 'Creating', 'Available', 'Shutdown', 'Deleted'
    machine: data.machine?.displayName,
    webUrl: data.web_url,
    connection: data.connection,
  }
}

// ── Start/Stop Codespace ──

export async function startCodespace(name) {
  const data = await githubFetch(`/user/codespaces/${name}/start`, { method: 'POST' })
  return { name, status: data.state, connection: data.connection }
}

export async function stopCodespace(name) {
  await githubFetch(`/user/codespaces/${name}/stop`, { method: 'POST' })
  return { name, status: 'Shutdown' }
}

// ── Delete Codespace ──

export async function deleteCodespace(name) {
  await githubFetch(`/user/codespaces/${name}`, { method: 'DELETE' })
  return { name, deleted: true }
}

// ── Execute Code via GitHub Actions ──
// The primary execution method — works from Edge runtime (no SSH needed)
// 1. Ensures the kivora-executor workflow exists in the repo
// 2. Dispatches the workflow with the code
// 3. Polls for completion
// 4. Reads the output from the committed result file

export async function executeInCodespace(repositoryOrCode, code, options = {}) {
  // Flexible API: executeInCodespace(repo, code, opts) or executeInCodespace(code, opts)
  let repo, execCode, execOptions
  if (typeof repositoryOrCode === 'string' && repositoryOrCode.includes('/')) {
    // First arg is a repo like "owner/repo"
    repo = repositoryOrCode
    execCode = code
    execOptions = options
  } else {
    // First arg is the code itself
    repo = defaultRepository
    execCode = repositoryOrCode
    execOptions = code || {}
  }

  const { language = 'bash', timeout = 120 } = execOptions

  if (!repo) {
    return {
      success: false,
      output: null,
      error: 'No repository configured for Codespaces execution. Set GITHUB_DEFAULT_REPO env var or pass repository in the tool call.',
      executor: 'codespaces',
    }
  }

  try {
    // 1. Ensure the executor workflow exists
    await ensureExecutorWorkflow(repo)

    // 2. Generate unique run ID and encode the code
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const encodedCode = typeof btoa !== 'undefined'
      ? btoa(unescape(encodeURIComponent(execCode)))
      : Buffer.from(execCode).toString('base64')

    // 3. Dispatch the workflow
    await githubFetch(`/repos/${repo}/actions/workflows/kivora-executor.yml/dispatches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          code: encodedCode,
          language,
          run_id: runId,
        },
      }),
    })

    // 4. Wait for the workflow run to appear
    await new Promise(r => setTimeout(r, 5000))

    // 5. Find the run
    const maxSearchTime = 30000
    const searchStart = Date.now()
    let workflowRun = null

    while (Date.now() - searchStart < maxSearchTime) {
      const runs = await githubFetch(
        `/repos/${repo}/actions/runs?per_page=3&event=workflow_dispatch`
      )
      const recent = runs.workflow_runs?.find(r =>
        r.name === 'Kivora Executor' &&
        Date.now() - new Date(r.created_at).getTime() < 120000
      )
      if (recent) {
        workflowRun = recent
        break
      }
      await new Promise(r => setTimeout(r, 5000))
    }

    if (!workflowRun) {
      return {
        success: false,
        output: null,
        error: 'Workflow run not found after dispatch. The workflow may still be processing.',
        executor: 'codespaces',
        runId,
      }
    }

    // 6. Poll for completion
    const maxWait = Math.min(timeout, 300) * 1000
    const execStart = Date.now()

    while (Date.now() - execStart < maxWait) {
      const run = await githubFetch(`/repos/${repo}/actions/runs/${workflowRun.id}`)
      if (run.status === 'completed') {
        // 7. Read the result file
        let output = ''
        let readAttempts = 0

        while (readAttempts < 5) {
          try {
            // Wait a bit for the commit to propagate
            await new Promise(r => setTimeout(r, 3000))

            const resultFile = await githubFetch(
              `/repos/${repo}/contents/kivora-results/${runId}.txt?ref=main`
            )
            if (resultFile?.content) {
              output = typeof atob !== 'undefined'
                ? decodeURIComponent(escape(atob(resultFile.content.replace(/\n/g, ''))))
                : Buffer.from(resultFile.content, 'base64').toString()
              break
            }
          } catch {
            // Result file not committed yet — retry
          }
          readAttempts++
          await new Promise(r => setTimeout(r, 5000))
        }

        // 8. Clean up the result file
        try {
          const resultFile = await githubFetch(
            `/repos/${repo}/contents/kivora-results/${runId}.txt?ref=main`
          )
          if (resultFile?.sha) {
            await githubFetch(
              `/repos/${repo}/contents/kivora-results/${runId}.txt`,
              {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: `kivora: cleanup result ${runId}`,
                  sha: resultFile.sha,
                  branch: 'main',
                }),
              }
            )
          }
        } catch { /* cleanup failed, not critical */ }

        return {
          success: run.conclusion === 'success',
          output: output.trim() || '(no output)',
          exitCode: run.conclusion === 'success' ? 0 : 1,
          executor: 'codespaces',
          backendName: 'GitHub Codespaces',
          runId,
          workflowUrl: run.html_url,
          duration: Date.now() - execStart,
        }
      }
      await new Promise(r => setTimeout(r, 8000))
    }

    // Timed out
    return {
      success: false,
      output: null,
      error: `Execution timed out after ${timeout}s. The workflow is still running — check ${workflowRun.html_url}`,
      executor: 'codespaces',
      runId,
      workflowUrl: workflowRun.html_url,
    }
  } catch (err) {
    return {
      success: false,
      output: null,
      error: `Codespaces execution failed: ${err.message}`,
      executor: 'codespaces',
    }
  }
}

// ── High-Level: Run Code (Full Lifecycle) ──
// Used by the smart router (codeExecutor.js) as a fallback backend

export async function runInCodespace(code, options = {}) {
  const {
    repository,
    language = 'python',
    timeout = 120,
  } = options

  const repo = repository || defaultRepository

  if (!repo) {
    return {
      success: false,
      output: null,
      error: 'No repository configured for Codespaces. Set GITHUB_DEFAULT_REPO env var or pass repository in the tool call.',
      executor: 'codespaces',
    }
  }

  return executeInCodespace(repo, code, { language, timeout })
}

// ── Available Repos for Codespaces ──

export async function listAvailableRepos() {
  const data = await githubFetch('/user/repos?per_page=30&sort=updated&affiliation=owner')
  return data.map(r => ({
    id: r.id,
    full_name: r.full_name,
    private: r.private,
    language: r.language,
    default_branch: r.default_branch,
  }))
}

// ── Cleanup ──

export function cleanup() {
  githubToken = null
  _workflowEnsured.clear()
}
