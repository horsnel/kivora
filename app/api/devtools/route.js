import { groq, MODEL } from '@/lib/groq'
import { rateLimit } from '@/lib/ratelimit'

const PROMPTS = {
  code_explainer: ({ code, language }) =>
    `Explain this ${language} code in plain English. Be thorough but clear.
Break it down block by block or function by function.
Identify: what each part does, any design patterns used, potential bugs or improvements.
Format with markdown, use code snippets where helpful.

\`\`\`${language.toLowerCase()}
${code}
\`\`\``,

  regex: ({ description, language }) =>
    `Generate a ${language} regex pattern that does exactly this: ${description}

Return:
## The Pattern
\`\`\`
regex here
\`\`\`

## Breakdown
Explain each part of the pattern character by character.

## Examples — Matches
List 5 strings that match.

## Examples — Non-matches
List 3 strings that do NOT match and why.

## Usage in ${language}
\`\`\`${language.toLowerCase()}
// code snippet showing how to use it
\`\`\``,

  json_formatter: ({ json }) =>
    `Analyze and format this JSON.

Return:
## Formatted JSON
\`\`\`json
// properly formatted here
\`\`\`

## Validation
Is it valid? If not, what's wrong?

## Structure Summary
Describe the shape: top-level keys, value types, nesting depth, array sizes.

## Suggestions
Any improvements, missing fields, or issues to flag?

Raw JSON:
${(json || '').slice(0, 8000)}`,

  readme: ({ info }) =>
    `Generate a professional, complete README.md for this project.

Project info:
${info}

Include these sections (use proper markdown):
# Project Name
Brief description badge line if applicable

## What It Does
## Features
## Tech Stack
## Getting Started (Prerequisites + Installation)
## Usage
## API Reference (if applicable)
## Environment Variables (if applicable)
## Contributing
## License

Make it look polished — the kind of README that gets GitHub stars.`,

  sql_builder: ({ description, dialect }) =>
    `Generate a ${dialect} SQL query for this requirement: ${description}

Return:
## Query
\`\`\`sql
-- Formatted SQL here
\`\`\`

## Explanation
What does this query do, step by step?

## Performance Notes
Any indexes that would help? Any expensive operations to watch for?

## Alternatives
Are there other approaches? Trade-offs?`,

  api_analyzer: ({ endpoint, method, headers, body }) =>
    `Analyze this API request and help debug or improve it.

Endpoint: ${endpoint || 'not provided'}
Method: ${method || 'GET'}
Headers: ${headers || 'none'}
Body: ${body || 'none'}

Return:
## Request Analysis
Is this correctly formed? What does it do?

## Potential Issues
Common problems with this type of request.

## Expected Response
What a successful response should look like.

## Improvements
How to make this request more robust or correct.

## Curl Equivalent
\`\`\`bash
curl command here
\`\`\``
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  try {
    const { tool, payload } = await req.json()
    const promptFn = PROMPTS[tool]
    if (!promptFn) {
      return Response.json({ error: 'Invalid tool' }, { status: 400 })
    }

    const chat = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: promptFn(payload || {}) }]
    })

    return Response.json({ result: chat.choices[0].message.content })
  } catch (err) {
    console.error('[devtools]', err)
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
