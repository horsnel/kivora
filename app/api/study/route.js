export const runtime = 'edge'
import { groq, MODEL, groqChat } from '@/lib/groq'
import { rateLimit } from '@/lib/ratelimit'

const PROMPTS = {
  homework: ({ subject, question }) =>
    `You are an expert ${subject} tutor. A student needs help with this question.
Answer with clear step-by-step reasoning. Show your work. Explain concepts so they actually understand — not just the final answer.
Use markdown formatting for clarity. Where relevant, give real-world context.

Question: ${question}`,

  essay: ({ topic, level }) =>
    `You are an academic writing coach for ${level} level students.
Create a detailed, well-structured essay outline for: "${topic}"

Include:
- Thesis statement
- Introduction approach (hook, context, thesis)
- 4-5 body sections with:
  - Section heading
  - 3-4 bullet points of sub-arguments or evidence
- Conclusion approach
- Suggested sources to look up (not fabricated)

Format with clean markdown.`,

  research: ({ text }) =>
    `You are a research assistant. Summarize this academic paper or article into clear structured sections.

## Main Argument
## Key Findings
## Methodology (if present)
## Limitations
## Why It Matters / So What?
## Questions This Raises

Keep each section tight. Be direct. Don't pad.

Text to analyze:
${text.slice(0, 4000)}`,

  citation: ({ source, style }) =>
    `Generate a correctly formatted ${style} citation for this source.
If any information is missing, note it with [missing: field] but do your best.
Return only the formatted citation — nothing else.

Source info:
${source}`,

  coding: ({ language, level }) =>
    `You are a coding practice coach for ${level} developers.
Generate a ${language} coding challenge appropriate for ${level} level.

Format:
## Problem
[Clear description]

## Example
Input: ...
Output: ...

## Hints
||Hint 1: ...||
||Hint 2: ...||

## Solution
\`\`\`${language.toLowerCase()}
// Full solution here with comments
\`\`\`

## Explanation
[Why this solution works, time/space complexity if relevant]`,

  flashcard: ({ subject, notes, count }) =>
    `You are a flashcard creation assistant. Generate ${count} flashcards about the following topic in ${subject}.

Topic/Notes: ${notes}

Format each flashcard EXACTLY like this:

### Card 1
**Front:** [Question or concept — clear and concise]
**Back:** [Answer or explanation — thorough but focused]

### Card 2
**Front:** [Question or concept]
**Back:** [Answer or explanation]

(Continue for all ${count} cards)

After all cards, include:

## Review Tips
- Spaced repetition advice for studying these cards effectively
- How to schedule reviews (e.g., Day 1, Day 3, Day 7, Day 14)
- Tips for active recall vs passive recognition
- Which cards might need more frequent review

Use markdown formatting. Make fronts clear and concise. Make backs thorough but focused.`,

  quiz: ({ subject, topic, difficulty, count }) =>
    `You are a quiz generation assistant. Create a ${difficulty} difficulty quiz with ${count} multiple choice questions about "${topic}" in ${subject}.

Format each question EXACTLY as follows — do NOT deviate from this format:

Q1: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Answer: [A/B/C/D]
Explanation: [Why the correct answer is correct, briefly]

Q2: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Answer: [A/B/C/D]
Explanation: [Why the correct answer is correct, briefly]

(Continue for all ${count} questions)

At the end, include:

## Answer Key
1. [A/B/C/D]
2. [A/B/C/D]
...
${count}. [A/B/C/D]

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- Only ONE correct answer per question
- Make distractors plausible but clearly wrong
- Questions should be clear and unambiguous
- Match the ${difficulty} difficulty level appropriately
- Do NOT use markdown bold/italic in the question format — keep it plain text`
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  try {
    if (!groq) {
      return Response.json({ error: 'AI service not configured' }, { status: 503 })
    }
    const { type, payload } = await req.json()
    const promptFn = PROMPTS[type]
    if (!promptFn) {
      return Response.json({ error: 'Invalid type' }, { status: 400 })
    }

    const chat = await groqChat({
      model: MODEL,
      messages: [{ role: 'user', content: promptFn(payload || {}) }]
    })

    return Response.json({ result: chat.choices[0].message.content })
  } catch (err) {
    console.error('[study]', err)
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
