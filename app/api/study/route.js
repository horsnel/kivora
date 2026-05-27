export const runtime = 'edge'
import { groq, MODEL, groqChat, GroqError, getPrimaryClientAsync } from '@/lib/groq'
import { getEnvVar } from '@/lib/cfEnv'
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
- Do NOT use markdown bold/italic in the question format — keep it plain text`,

  notes: ({ subject, topics, style }) => {
    const styleInstructions = {
      'Cornell Notes': `Use the Cornell Notes format:
- Divide each section into: **Cue/Question** (left column), **Notes** (right column), **Summary** (bottom)
- Format as markdown tables or clearly separated sections
- Include a "Cues/Questions" column with key prompts
- Include a "Notes" column with detailed information
- End each major section with a brief summary`,
      'Outline': `Use a hierarchical outline format:
- Use markdown headings (##, ###) for main topics and subtopics
- Use bullet points for details under each subtopic
- Use numbered lists for sequential information
- Indent properly to show hierarchy`,
      'Mind Map Text': `Use a text-based mind map format:
- Start with the central topic
- Use indented bullet points to show branches
- Use → or ► to indicate connections
- Group related concepts together
- Keep branches concise but meaningful`,
      'Summary': `Use a concise summary format:
- Start with a brief overview paragraph
- Follow with key points as bullet lists
- Include important definitions and formulas
- End with connections between topics`,
    }

    return `You are a study notes generation assistant. Create comprehensive, well-organized study notes for the following topics in ${subject}.

Topics/Key Concepts: ${topics}
Note Style: ${style}

${styleInstructions[style] || styleInstructions['Outline']}

Structure your notes with:

## Overview
A brief introduction to the topic(s) and why they matter.

## Key Concepts
Organized sections for each major concept, including:
- Clear definitions
- Important formulas, equations, or facts (where applicable)
- Examples to illustrate each concept
- Common misconceptions or pitfalls

## Connections
How the topics relate to each other and to broader ${subject} concepts.

## Review Questions
5-8 questions to test understanding of the material. Include brief answers.

## Quick Reference
A condensed cheat-sheet style summary of the most important points, formulas, and definitions.

Rules:
- Be thorough but concise — every sentence should add value
- Use markdown formatting for clarity (headings, bold, lists, code blocks for formulas)
- Include real, accurate examples (not generic placeholders)
- Make the notes suitable for exam preparation
- Prioritize clarity and accuracy over length`
  }
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
    const { type, payload } = await req.json()
    const promptFn = PROMPTS[type]
    if (!promptFn) {
      return Response.json({ error: 'Invalid type' }, { status: 400 })
    }

    const chat = await groqChat({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an exceptional AI tutor and academic assistant integrated into Kivora StudyDesk. You explain complex concepts with the clarity of the best teacher the student has ever had — patient, precise, and genuinely helpful. Break things down step by step. Use real-world analogies that make abstract ideas click. Anticipate where students get confused and address it proactively. Use rich markdown: **bold** for key terms, code blocks for formulas and code, tables for comparisons, and headings for structure. Never be condescending. Never be vague. Make every student feel like they can master this material.'
        },
        {
          role: 'user',
          content: promptFn(payload || {})
        }
      ]
    })

    return Response.json({ result: chat.choices[0].message.content })
  } catch (err) {
    console.error('[study]', err)
    if (err instanceof GroqError && err.code === 'GROQ_QUOTA_EXCEEDED') {
      return Response.json({ error: 'Too many requests, try again later.', quotaExceeded: true }, { status: 429 })
    }
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
