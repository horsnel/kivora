export const runtime = 'edge'
import { groq, MODEL, groqChat, GroqError, getPrimaryClientAsync } from '@/lib/groq'
import { getEnvVar } from '@/lib/cfEnv'
import { rateLimit } from '@/lib/ratelimit'

const PROMPTS = {

  // ── CODE TOOLS ─────────────────────────────────────────────────────

  code_explainer: (p) => `Explain this ${p.language} code in plain English. Be thorough but clear.
Break it down block by block or function by function.
Identify: what each part does, any design patterns used, potential bugs, and improvement suggestions.
Format with markdown headings and use code snippets where helpful.

\`\`\`${p.language?.toLowerCase()}
${(p.code || '').slice(0, 8000)}
\`\`\``,

  code_reviewer: (p) => `Review this ${p.reviewLang} code like a senior engineer doing a thorough PR review.

\`\`\`${p.reviewLang?.toLowerCase()}
${(p.reviewCode || '').slice(0, 8000)}
\`\`\`

Structure your review with these sections:

## Overall Assessment
A 2-sentence verdict on the code quality.

## Bugs and Errors
Any bugs, logic errors, or things that will break. Mark severity: Critical / Warning / Minor.

## Security Issues
Any security vulnerabilities — injection risks, exposed secrets, unsafe inputs, etc.

## Performance
Any inefficient patterns, unnecessary re-renders, N+1 queries, or memory issues.

## Code Quality
Readability, naming, structure, and maintainability issues.

## What's Done Well
2–3 things the code does correctly or that are worth keeping.

## Suggested Improvements
Specific, actionable changes with brief example rewrites where helpful.`,

  regex: (p) => `Generate a ${p.regexLang} regex pattern that does exactly this: ${p.description}

## The Pattern
\`\`\`
regex here
\`\`\`

## How to Use It in ${p.regexLang}
\`\`\`${p.regexLang?.toLowerCase()}
// Usage code snippet
\`\`\`

## Breakdown
Explain each part of the pattern character by character so the user understands it.

## Test Cases — Matches
List 5 strings that match this pattern.

## Test Cases — Non-matches
List 3 strings that do NOT match and explain why.

## Edge Cases
Any common edge cases or gotchas to be aware of.`,

  sql_builder: (p) => `Generate a ${p.dialect} SQL query for this requirement: ${p.sqlDesc}

## Query
\`\`\`sql
-- Formatted, readable SQL here with comments
\`\`\`

## Explanation
What does this query do, step by step?

## Indexes That Would Help
Which columns should be indexed for this query to perform well?

## Performance Notes
Any expensive operations, potential slow paths, or scale considerations?

## Alternative Approaches
Are there other ways to write this? What are the trade-offs?`,

  terminal: (p) => `You are a ${p.terminalContext} terminal expert.

Task or command: ${p.terminalCmd}

## The Command
\`\`\`bash
# The command(s) to run
\`\`\`

## What It Does
Step-by-step explanation of what happens when you run this.

## Common Variations
2–3 useful variants of this command for slightly different situations.

## Safety Notes
Anything that could go wrong or that the user should be careful about (especially for destructive commands like rm, chmod, etc.).

## Example Output
What typical output looks like when it succeeds.`,

  git_helper: (p) => `You are a Git expert. Answer this git question or complete this git task:

${p.gitCmd}

## Answer / Solution
Clear, direct answer. If it's a command, show the exact command(s) to run.

\`\`\`bash
# Git commands here
\`\`\`

## Explanation
Why this works and what each part does.

## Common Mistakes
What trips people up with this.

## Related Commands
2–3 related git commands that are useful to know alongside this.`,

  regex_tester: (p) => `Analyze this regular expression and explain it thoroughly:

Pattern: ${p.regexPattern}
Flags: ${p.regexFlags}
Test string: ${(p.regexTestString || '').slice(0, 3000)}

## Pattern Breakdown
Explain each part of this regex character by character or group by group.

## What It Matches
Describe in plain English what strings this pattern matches.

## Flags
Explain what each flag does and why it matters for this pattern.

## Edge Cases
Common strings that might unexpectedly match or fail to match.

## Performance Notes
Any catastrophic backtracking risks or performance concerns with this pattern.

## Alternative Patterns
If there are simpler or more robust ways to match the same thing, suggest them.`,

  // ── DATA TOOLS ────────────────────────────────────────────────────

  json_formatter: (p) => `Analyze and format this JSON:

${(p.json || '').slice(0, 10000)}

## Formatted JSON
\`\`\`json
// Properly formatted and indented
\`\`\`

## Validation Status
Is this valid JSON? If not, identify exactly what's wrong and where.

## Structure Summary
Describe the shape: top-level keys, value types, nesting depth, array sizes.

## Suggestions
Any improvements, missing fields, inconsistent naming conventions, or structural issues to flag.`,

  csv_analyser: (p) => `Analyze this CSV data${p.csvGoal ? ` with this specific goal: ${p.csvGoal}` : ''}.

CSV data:
${(p.csvData || '').slice(0, 8000)}

## Data Overview
How many rows and columns. What each column contains and its data type.

## Key Insights
${p.csvGoal ? `Specific answer to: ${p.csvGoal}` : '5 most interesting patterns, trends, or facts from this data.'}

## Data Quality Issues
Missing values, inconsistencies, duplicates, or formatting problems.

## Suggested Analysis
3–5 questions this data could answer that would be useful to explore.

## Suggested Visualisations
What charts or graphs would best represent this data and why.`,

  data_to_schema: (p) => `Generate a complete database schema for this data model:

${p.schemaDesc}

## PostgreSQL Schema (Primary)
\`\`\`sql
-- Complete CREATE TABLE statements with:
-- Primary keys, foreign keys, indexes, constraints
-- Timestamps (created_at, updated_at) on all tables
-- Appropriate data types for each column
\`\`\`

## Row-Level Security (RLS)
\`\`\`sql
-- Supabase RLS policies for user data isolation
\`\`\`

## Indexes to Create
Which columns to index and why.

## Relationships Diagram
ASCII diagram showing how tables relate to each other.

## Considerations
Any design decisions made and alternatives to consider.`,

  api_analyzer: (p) => `Analyze this API request:

Endpoint: ${p.endpoint || 'not provided'}
Method: ${p.method || 'GET'}
Headers: ${p.headers || 'none'}
Body: ${p.body || 'none'}

## Request Analysis
Is this correctly formed? What does it do?

## Potential Issues
Common problems with this type of request — missing headers, incorrect content-type, auth issues, etc.

## Expected Successful Response
What a 200 response should look like for this endpoint.

## Improved Request
The corrected version if there are issues.

## Curl Equivalent
\`\`\`bash
curl command here
\`\`\`

## Error Scenarios
Most common error codes you'll encounter and what they mean.`,

  env_checker: (p) => `Audit this .env file for security issues and best practices.

Note: Do not reproduce any actual secret values in your response.

.env contents:
${(p.envContent || '').slice(0, 4000)}

## Security Issues
Critical issues that must be fixed immediately.
Warnings that should be addressed.
Minor suggestions.

## Variables Missing
Common environment variables that look like they should be here but aren't.

## Naming Conventions
Any inconsistent or non-standard variable naming.

## Public vs Private
Flag any variables that look like they should have (or shouldn't have) NEXT_PUBLIC_ / VITE_ / REACT_APP_ prefix.

## Recommendations
Best practices for this specific environment setup.`,

  jwt_decoder: (p) => `Analyze this JWT token and explain its claims:

${(p.jwtToken || '').slice(0, 4000)}

## Token Structure
Identify the algorithm, type, and key header fields.

## Claims Breakdown
Explain each claim in the payload — what it means, whether the value is typical, and any concerns.

## Expiration Status
Is this token expired? When does/did it expire? Is the expiry reasonable for this type of token?

## Security Observations
Any security concerns: weak algorithm, missing claims, unusual values, potential misuse.

## Recommendations
Best practices for this token type and any improvements to suggest.`,

  base64: (p) => `${p.base64Mode === 'encode' ? 'Encode' : 'Decode'} this ${p.base64Mode === 'encode' ? 'text' : 'Base64 string'} and explain the result:

Input:
${(p.base64Input || '').slice(0, 6000)}

## Result
The ${p.base64Mode === 'encode' ? 'Base64 encoded' : 'decoded'} output.

## How Base64 Works
Brief explanation of Base64 encoding/decoding.

## Observations
${p.base64Mode === 'decode' ? 'What does the decoded content appear to be? Is it JSON, a URL, a token, binary data? Any patterns or security concerns?' : 'How much larger is the encoded output vs the input? Any characters that might cause issues in URLs?'}

## URL-Safe Variant
If this were URL-safe Base64, what would change?`,

  // ── CONTENT TOOLS ─────────────────────────────────────────────────

  readme: (p) => `Generate a professional, complete README.md for this project.

Project info:
${p.info}

Write a polished README with these sections using proper markdown:

# Project Name
Brief one-line description + relevant badges

## What It Does
## Why Use This / Key Benefits
## Features (bullet list)
## Tech Stack
## Prerequisites
## Installation
## Usage (with code examples)
## Environment Variables (table format: Variable | Required | Description | Example)
## API Reference (if applicable)
## Contributing
## License

Make it look like the kind of README that gets GitHub stars — clear, useful, well-structured.`,

  email_writer: (p) => `Write a professional email with these details:

Recipient: ${p.emailRecipient || 'the recipient'}
Tone: ${p.emailTone}
Context / what to communicate: ${p.emailContext}

## Subject Line
A clear, specific subject line (under 60 characters).

## Email Body
The complete, ready-to-send email.

Rules:
- Match the ${p.emailTone} tone throughout
- Lead with the most important point
- One clear ask or action in the final paragraph
- No filler phrases: "Hope this finds you well", "Don't hesitate to reach out", "Per my last email"
- Keep it under 200 words unless the context requires more

## Alternative Subject Line
A second option with a different angle.`,

  text_improver: (p) => `Rewrite this text to ${p.textGoal?.toLowerCase()}.

Original text:
${(p.textInput || '').slice(0, 5000)}

## Improved Version
The rewritten text.

## What Changed
Key changes made and why — specific improvements, not vague praise.

## Before/After Highlights
2–3 specific sentence comparisons showing the improvement.`,

  translator: (p) => `Translate the following text to ${p.targetLang}.

Source text:
${(p.translateText || '').slice(0, 5000)}

## Translation
The complete translation. Match the tone and style of the original.

## Notes
Any words or phrases that don't have a direct equivalent, cultural notes, or alternative translations for ambiguous terms.

## Tone Check
Confirm the tone of the translation (formal/informal/neutral) and whether it matches the original.`,

  summariser: (p) => `Summarise this text as: ${p.summariseStyle}

Text to summarise:
${(p.summariseText || '').slice(0, 10000)}

## Summary
${p.summariseStyle === 'Bullet points' ? 'A concise bullet-point list of the key points. Max 10 bullets.' : ''}
${p.summariseStyle === 'One paragraph' ? 'A single clear paragraph capturing the essence. Max 150 words.' : ''}
${p.summariseStyle === 'Executive summary' ? 'A structured executive summary: Context, Key Findings, Implications, Recommended Actions.' : ''}
${p.summariseStyle === 'Tweet thread' ? '5 tweets that capture the key points. Each under 280 characters. Add (1/5), (2/5) etc.' : ''}
${p.summariseStyle === 'ELI5 (simple)' ? 'Explain this like the reader has no prior knowledge of the topic. Simple words, short sentences.' : ''}
${p.summariseStyle === 'Key quotes only' ? 'Extract the 5 most important direct statements or data points from the text.' : ''}

## Key Takeaway
One sentence: the single most important thing from this text.`,

  // ── BUSINESS TOOLS ────────────────────────────────────────────────

  pitch_writer: (p) => `Write a compelling pitch for:

Product/Service: ${p.pitchProduct}
Audience: ${p.pitchAudience}
The Ask: ${p.pitchAsk}

## The Pitch (Elevator Version — 60 seconds)
A punchy 150-word version for when you have very little time.

## The Full Pitch
A complete pitch covering:
- The problem (make them feel it)
- The solution (your product/service)
- Why now (why this moment is right)
- Traction (if applicable — metrics, customers, revenue)
- The ask (specific, clear, justified)

## Opening Hook
3 alternative opening lines — the first sentence is the most important. Give options.

## Objection Responses
The top 3 objections this audience will raise, with responses for each.`,

  job_desc: (p) => `Write a job description for:

Role: ${p.jobTitle}
Responsibilities: ${p.jobResponsibilities}
Requirements: ${p.jobRequirements}

Write a job description that attracts top candidates.

## Job Title
The exact title (may suggest a better version of what was given).

## The Role In One Sentence
What this person owns and why it matters.

## What You'll Do (Responsibilities)
Responsibilities written as outcomes ("You'll own X", "You'll build Y") — not task lists.

## What We're Looking For
Must-have skills and experience — keep to 4–5 non-negotiable items.

## Nice to Have
2–3 things that help but won't rule someone out.

## Why Join Us
2–3 genuine reasons — not "work with great people and impact millions."

Do NOT include: "fast-paced environment", "self-starter", "rockstar", "ninja", "passionate", "competitive salary"`,

  sop_writer: (p) => `Write a complete Standard Operating Procedure (SOP) for:

Process: ${p.sopProcess}
Who follows this: ${p.sopRole}

## SOP: ${p.sopProcess || 'Process Name'}

**Owner**: ${p.sopRole || 'Role'}
**Frequency**: [How often this is performed]
**Time Required**: [Estimated time]
**Last Updated**: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

---

## Purpose
Why this process exists and what outcome it produces.

## Before You Start
What the person needs: access, tools, information, context.

## Steps
Numbered steps. Each step = one clear action  expected result.
Use sub-steps for conditional logic ("If X, then Y").

## Quality Checklist
Checkboxes to verify completion before marking done.

## Common Mistakes
The 3 most frequent errors people make and how to avoid them.

## When Things Go Wrong
What to do if something breaks or is unclear.

## Related Processes
Other SOPs that connect to this one.`,

  cold_email: (p) => `Write a cold email campaign for:

Target: ${p.coldTarget}
Product/service: ${p.coldProduct}
${p.coldObservation ? `Specific observation about their business: ${p.coldObservation}` : ''}

Write a 3-email sequence.

---

## Email 1 — The Initial Outreach (Day 0)

**Subject**: [Under 8 words. Specific. No "quick question".]

**Body**: [Under 80 words.
${p.coldObservation ? 'Open with the specific observation. ' : 'Open with a genuine, relevant observation about their business. '}
State the specific result you've helped someone similar achieve.
End with the smallest possible ask — not a 30-minute call.]

---

## Email 2 — Different Angle (Day 4)

**Subject**: [Different hook from email 1]

**Body**: [Under 60 words. Different angle — share a case study, a relevant insight, or a specific question. Not "just checking in".]

---

## Email 3 — The Breakup Email (Day 10)

**Subject**: [Closing the loop]

**Body**: [Under 40 words. Signal you're moving on. Creates finality that generates replies from interested people who were busy.]

---

## Why This Works
The reasoning behind each email's approach.

## Personalisation Variables
What to research per prospect to make email 1 feel genuinely personal.`,

  // ── EDUCATION TOOLS ────────────────────────────────────────────────

  math_solver: (p) => `You are an expert math tutor. Solve this equation step by step, showing every step clearly.

Equation: ${p.mathEquation}
${p.mathContext ? `Additional context: ${p.mathContext}` : ''}

## Step-by-Step Solution
Show every step of the solution process. For each step:
- State what you're doing and why
- Show the mathematical operation clearly
- Use proper mathematical notation (LaTeX where helpful)

## Final Answer
State the final answer clearly, boxed or highlighted.

## Verification
Verify the answer by substituting back into the original equation.

## Key Concepts
Explain the key mathematical concepts used in this solution. What type of equation is this? What methods apply?

## Common Mistakes
2-3 common mistakes students make with this type of problem and how to avoid them.`
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    const groqKey = await getEnvVar('GROQ_API_KEY')
    const groqClient = await getPrimaryClientAsync(groqKey)
    if (!groqClient) {
      return Response.json({ error: 'AI service not configured' }, { status: 503 })
    }
    const { tool, payload } = await req.json()
    const promptFn = PROMPTS[tool]

    if (!promptFn) {
      return Response.json({ error: `Unknown tool: ${tool}` }, { status: 400 })
    }

    const chat = await groqChat({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a senior engineer and expert AI assistant integrated into Kivora DevTools, a professional toolkit for developers and builders. You write production-ready code, spot issues that junior engineers miss, and explain technical concepts with the precision of a principal engineer at a top tech company. Be specific and practical — never vague, never generic, never padded. Prefer showing over telling. Use rich markdown: **bold** for key terms, tables for comparisons, code blocks with language tags, headings (##/###) for sections, and > [!tip] or > [!note] blockquotes for callouts. When you write code, it should work on the first try. When you review code, be thorough but constructive. When you explain, make it click.'
        },
        {
          role: 'user',
          content: promptFn(payload || {})
        }
      ]
    })

    return Response.json({ result: chat.choices[0].message.content })
  } catch (err) {
    console.error('[devtools]', err)
    if (err instanceof GroqError && err.code === 'GROQ_QUOTA_EXCEEDED') {
      return Response.json({ error: 'Too many requests, try again later.', quotaExceeded: true }, { status: 429 })
    }
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
