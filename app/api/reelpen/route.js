export const runtime = 'edge'
import { groq, MODEL, groqChat, GroqError, getPrimaryClientAsync, setGeminiApiKey, setOpenrouterApiKey } from '@/lib/groq'
import { getEnvVar } from '@/lib/cfEnv'
import { rateLimit } from '@/lib/ratelimit'

const PROMPTS = {
  lyrics_writer: ({ genre, mood, language, lyricsTheme }) =>
    `You are a world-class songwriter and lyricist whose craft is shaped by the most unforgettable, emotionally devastating, and culturally iconic lines from cinema and television history. You channel the spirit of lines like:

- "Here's looking at you, kid." — Casablanca
- "I'm also just a girl, standing in front of a boy, asking him to love her." — Notting Hill
- "They may take our lives, but they'll never take our freedom!" — Braveheart
- "After all, tomorrow is another day." — Gone with the Wind
- "I could've got more." — Schindler's List
- "To infinity and beyond!" — Toy Story
- "I am Iron Man." — Avengers: Endgame
- "Love is putting someone else's needs before yours." — Frozen
- "The night is darkest just before the dawn." — The Dark Knight
- "Mere pass maa hai." — Deewaar
- "E.T. phone home." — E.T.
- "I see dead people." — The Sixth Sense
- "Life is like a box of chocolates." — Forrest Gump
- "Why so serious?" — The Dark Knight
- "Wakanda Forever." — Black Panther

Write original song lyrics for the following:

Genre: ${genre}
Mood: ${mood}
Language: ${language}
Theme/Topic: ${lyricsTheme}

Your lyrics must:
- Open with a line that hits as hard as a classic movie quote — immediate emotional gravity
- Use cinematic storytelling: vivid scenes, sensory detail, dramatic pauses, and moments of revelation
- Weave in the emotional DNA of the great film and TV moments — heartbreak, defiance, hope, sacrifice, love, rebellion, redemption
- Structure clearly: Verse 1, Pre-Chorus, Chorus, Verse 2, Bridge, Outro
- Each section should feel like a scene in a film — with its own arc, tension, and release
- The chorus must be the emotional climax — the line audiences quote for decades
- Avoid clichés and generic phrases. Every line should feel earned and specific
- If the language is not English, write primarily in that language but mix in English phrases where culturally authentic (e.g. Nigerian Pidgin, Yoruba phrases in Afrobeats)
- End with an outro line that lingers like the final frame of a great film — unresolved, haunting, or transcendent

Format with markdown headings for each section.`,

  chord_progression: ({ chordKey, chordMood, chordGenre, chordComplexity }) =>
    `You are a music theory expert and producer. Suggest chord progressions for:

Key: ${chordKey}
Mood: ${chordMood}
Genre: ${chordGenre}
Complexity: ${chordComplexity}

Provide:
## Primary Progression
[Main progression with chord names and Roman numeral analysis]

## Alternative Progressions
[2-3 alternative options with different feels]

## Voicing Suggestions
[Specific voicings or inversions that work well for ${chordGenre}]

## Song Sections
- Verse: [progression]
- Chorus: [progression]  
- Bridge: [progression]

## Tips
[Genre-specific tips for making these chords sound authentic]
${chordComplexity === 'Advanced' ? '\nInclude extended chords (7ths, 9ths, 11ths, 13ths), modal interchange, and voice leading.' : chordComplexity === 'Intermediate' ? '\nInclude some 7th chords and passing chords.' : '\nKeep it simple with triads and basic 7th chords.'}`,

  artist_bio: ({ artistName, artistGenre, artistAchievements, artistTone }) =>
    `You are a professional music publicist. Write a compelling artist biography for:

Artist Name: ${artistName}
Genre: ${artistGenre}
Key Achievements: ${artistAchievements || 'Up-and-coming artist'}
Tone: ${artistTone}

Write a bio that includes:
## Short Bio (50 words)
[For social media profiles and quick intros]

## Full Bio (200-300 words)
[For press kits, websites, and EPKs]

## One-Liner
[A single powerful sentence that captures who they are]

Rules:
- Be specific and vivid, not generic
- Use the ${artistTone.toLowerCase()} tone throughout
- If achievements are not provided, focus on potential and sound
- Include the genre context naturally
- Make it feel authentic, not press-release stiff`,

  epk_builder: ({ epkArtistName, epkGenre, epkHighlights, epkContact }) =>
    `You are an entertainment industry professional creating an Electronic Press Kit (EPK) for:

Artist Name: ${epkArtistName}
Genre: ${epkGenre}
Highlights & Press: ${epkHighlights || 'Rising artist'}
Contact: ${epkContact || 'To be added'}

Generate a complete EPK with:

## Artist Overview
[Compelling 2-3 paragraph introduction]

## Quick Facts
- **Genre:** ${epkGenre}
- **Based in:** [suggest based on context]
- **Years Active:** [suggest]
- **Label:** [Independent or suggest]

## Key Achievements
[Bullet points of highlights, expand on what's provided]

## Notable Releases
[Suggest 3-4 realistic release entries with titles, dates, and streaming numbers]

## Press Quotes
[Create 2-3 realistic placeholder press quotes that could appear]

## Social & Streaming
[Suggested platforms with placeholder links]

## Contact
${epkContact || '[Add booking/management contact]'}`,

  press_release: ({ pressType, pressTitle, pressDate, pressDetails }) =>
    `You are a professional music/film publicist. Write a press release for:

Release Type: ${pressType}
Title: ${pressTitle}
Date: ${pressDate || 'TBD'}
Details: ${pressDetails}

Format as a proper press release:

**FOR IMMEDIATE RELEASE**

# [Headline — attention-grabbing]

[City, Country] — [Opening paragraph with the who, what, when, where, why]

[Second paragraph with more context and details]

[Quote from the artist/creator — make it authentic and specific]

[Third paragraph with additional context — production credits, collaborators, etc.]

[Closing paragraph about availability — where to stream/watch/buy]

**###**

[Boiler plate — short bio paragraph about the artist/project]

**Media Contact:**
[Placeholder for contact info]`,

  marketing_plan: ({ marketingType, marketingBudget, marketingAudience, marketingPlatforms }) =>
    `You are a music/film marketing strategist. Create a comprehensive marketing plan for:

Release Type: ${marketingType}
Budget: ${marketingBudget}
Target Audience: ${marketingAudience}
Platforms: ${marketingPlatforms || 'All major platforms'}

Generate:

## Overview
[Brief strategy summary]

## Timeline
[4-8 week countdown plan with specific actions per week]

## Pre-Release (Weeks -4 to -1)
[Detailed pre-release strategy — teasers, pre-save, press outreach, etc.]

## Launch Week
[Day-by-day launch plan]

## Post-Release (Weeks +1 to +4)
[Sustained engagement strategy]

## Content Ideas
[10-15 specific content ideas — social posts, videos, challenges, etc.]

## Playlist / Platform Strategy
[Specific approach for each relevant platform]

## Budget Breakdown
[Estimated allocation across categories for ${marketingBudget} budget]

## KPIs & Metrics
[What to track and success benchmarks]`,

  social_kit: ({ socialInfo, socialPlatform, socialTone }) =>
    `You are a social media strategist for music/film creators. Create social media content for:

Release Info: ${socialInfo}
Platform: ${socialPlatform}
Tone: ${socialTone}

Generate:

## Captions
[5-8 ready-to-post captions with hashtags, optimized for ${socialPlatform}]

## Story Ideas
[4-6 Instagram/Facebook Story concepts with text overlays]

## TikTok / Reels Hooks
[3-5 video hook scripts — first 3 seconds that grab attention]

## Engagement Prompts
[Questions and CTAs that drive comments and shares]

## Hashtag Sets
[3 sets of 10-15 relevant hashtags — mix of popular and niche]

Rules:
- Match the ${socialTone.toLowerCase()} tone
- Include relevant emojis where appropriate for the platform
- Keep captions within platform character limits
- Make everything feel authentic, not corporate`,

  beat_description: ({ beatBpm, beatKey, beatGenre, beatMood, beatVibe }) =>
    `You are a beat producer and marketplace expert. Write a compelling beat listing for:

BPM: ${beatBpm || 'N/A'}
Key: ${beatKey}
Genre: ${beatGenre}
Mood: ${beatMood}
Vibe: ${beatVibe}

Generate:

## Title
[Attention-grabbing beat title — 3-6 words]

## Description
[2-3 paragraph marketplace listing that sells the vibe, references similar artists or tracks, and describes what the beat brings to an artist]

## Tags
[15-20 relevant tags for BeatStars/Traktrain]

## Similar Tracks
[3-5 reference tracks with artist and song name that this beat sounds like]

## Artist Fit
[What type of artist/vocalist would kill this beat]

## Pricing Suggestion
[Suggested license tiers — Basic, Premium, Exclusive]`,

  script_writer: ({ filmGenre, sceneDesc, filmCharacters }) =>
    `You are a professional screenwriter. Write a screenplay scene for:

Genre: ${filmGenre}
Scene: ${sceneDesc}
Characters: ${filmCharacters || 'Create appropriate characters'}

Write in proper screenplay format:

**INT./EXT. LOCATION — TIME OF DAY**

[Action lines describing the setting]

CHARACTER NAME
Dialogue here.

[More action, dialogue, etc.]

Rules:
- Use proper screenplay formatting conventions
- Show, don't tell — use action lines effectively
- Dialogue should feel natural and specific to each character
- Include parentheticals only when necessary for delivery
- The scene should have a clear emotional arc
- Aim for 1-2 pages of screenplay`,

  character_builder: ({ charName, charRole, charGenre, charTraits }) =>
    `You are a script development consultant. Create a detailed character profile for:

Name: ${charName}
Role: ${charRole}
Genre: ${charGenre}
Traits/Background: ${charTraits || 'Create a compelling character'}

Generate:

## Overview
[One-paragraph character summary]

## Basic Info
- **Full Name:**
- **Age:**
- **Occupation:**
- **Background:**

## Personality
[Detailed personality description — strengths, flaws, contradictions]

## Motivation
[What drives this character — the want vs the need]

## Character Arc
[Beginning state → Catalyst → Growth → Resolution]

## Voice & Dialogue Style
[How they speak — vocabulary, rhythm, verbal tics, catchphrases]

## Relationships
[Key relationships and dynamics with other characters]

## Physical Description
[Appearance, style, distinguishing features]

## Secrets
[What they hide from others and themselves]`,

  plot_outline: ({ plotGenre, plotLength, plotPremise }) =>
    `You are a story development consultant. Create a structured plot outline for:

Genre: ${plotGenre}
Length: ${plotLength}
Premise: ${plotPremise}

Generate:

## Logline
[One-sentence story summary]

## Three-Act Structure

### Act 1 — Setup
[Opening image, introduction, inciting incident]

### Act 2 — Confrontation
[Rising action, midpoint, complications, crisis]

### Act 3 — Resolution
[Climax, falling action, final image]

## Key Characters
[Brief descriptions of 3-5 main characters]

## Major Plot Points
[Numbered list of 8-12 key scenes/beats]

## Themes
[2-3 central themes and how they're explored]

## Tone & Style Notes
[Cinematic/stylistic direction]

${plotLength === 'Series Pilot' ? '\n## Series Potential\n[How this episode sets up future storylines and character arcs]' : ''}`,

  pitch_deck: ({ pitchTitle, pitchLogline, pitchGenre, pitchBudget }) =>
    `You are a film industry consultant. Create a pitch deck treatment for:

Title: ${pitchTitle || 'Untitled Project'}
Logline: ${pitchLogline}
Genre: ${pitchGenre}
Budget Range: ${pitchBudget}

Generate:

## Logline
[Refined one-sentence summary]

## Synopsis
[2-3 paragraph story summary that hooks the reader]

## Tone & Comparisons
["It's [Film A] meets [Film B]" — with explanation of why]

## Visual Style
[Cinematographic vision, color palette, visual references]

## Key Characters
[3-4 character briefs with casting suggestions]

## Director's Vision
[Artistic statement about what makes this project unique]

## Market & Audience
[Target demographic, comparable box office, why now]

## Production Overview
- **Budget Range:** ${pitchBudget}
- **Shooting Format:** [Suggestion]
- **Locations:** [Suggestion]
- **Timeline:** [Suggestion]

## Team
[Placeholder sections for key team members]

## Why This Project
[Closing argument — commercial and artistic potential]`,

  synopsis_writer: ({ synopsisOutline, synopsisGenre, synopsisLength }) =>
    `You are a professional script reader and writer. Create a compelling film synopsis for:

Story Outline: ${synopsisOutline}
Genre: ${synopsisGenre}
Length: ${synopsisLength}

Write a synopsis that:
- Hooks the reader in the first sentence
- Clearly establishes the protagonist and their goal
- Shows the central conflict and stakes
- Reveals the emotional journey
- Ends with the thematic resonance (don't just say "they lived happily ever after")

${synopsisLength === 'Short (1 paragraph)' ? 'Write one tight paragraph (4-6 sentences).' : synopsisLength === 'Medium (2-3 paragraphs)' ? 'Write 2-3 paragraphs covering setup, conflict, and resolution.' : 'Write a full page synopsis with detailed story beats.'}`,

  dialogue_polisher: ({ dialogueRaw, dialogueContext, dialogueTone }) =>
    `You are a dialogue coach and screenwriter. Polish and improve this dialogue:

Context: ${dialogueContext || 'General scene'}
Desired Tone: ${dialogueTone}

Original Dialogue:
${dialogueRaw}

Provide:

## Polished Dialogue
[The improved version — more natural, sharper, character-specific]

## Changes Made
[Bullet list of what you changed and why]

## Alternative Takes
[2-3 alternative versions with different nuances]

## Tips for These Characters
[Specific advice for writing dialogue between these characters]`,

  review_responder: ({ reviewText, reviewRating, reviewTone }) =>
    `You are a professional publicist. Draft a response to this review:

Review: ${reviewText}
Rating: ${reviewRating || 'No rating'}
Response Tone: ${reviewTone}

Provide:

## Short Response (Social Media)
[1-2 sentences for Twitter/Instagram replies]

## Medium Response (Blog/Website Comments)
[3-4 sentences for comment sections]

## Full Response (Formal Reply)
[Full paragraph for official responses or open letters]

Rules:
- ${reviewTone === 'Firm / Defending' ? 'Stand your ground respectfully, address inaccuracies without being hostile' : reviewTone === 'Humorous' ? 'Use wit and charm to win the audience over' : reviewTone === 'Appreciative' ? 'Thank them genuinely, even if the review was mixed' : 'Maintain professionalism at all times'}
- Never attack the reviewer personally
- Address specific points if possible
- End on a positive or forward-looking note`,

  casting_brief: ({ castingCharacter, castingRequirements, castingProject }) =>
    `You are a casting director. Create a professional casting brief for:

Character: ${castingCharacter}
Requirements: ${castingRequirements || 'To be determined'}
Project Type: ${castingProject}

Generate:

## Project Overview
[Brief description of the project and its tone]

## Role Description
[Expanded character description with personality, arc, and importance to the story]

## Requirements
- **Age Range:**
- **Gender:**
- **Ethnicity/Look:** [If relevant]
- **Special Skills:** ${castingRequirements || 'None specified'}
- **Language:** [Required languages]
- **Physical Requirements:** [If any]

## Audition Notes
[What actors should prepare — monologue type, sides, etc.]

## Callback Information
[What to expect in callbacks]

## Submission Details
[How to submit — headshot, reel, etc.]

## Compensation
[Suggested terms based on ${castingProject}]`,

  contract_reviewer: ({ contractText, contractIndustry }) =>
    `You are an entertainment lawyer. Review this ${contractIndustry} contract and provide a plain-English analysis:

Contract Text:
${contractText.slice(0, 5000)}

Provide:

## Summary
[What this contract is about in simple terms]

## Key Terms
[The most important clauses and what they mean]

## ⚠️ Red Flags
[Anything that seems unfair, unusual, or potentially harmful]

## Favorable Terms
[What's good for the signing party]

## Missing Clauses
[Standard provisions that should be present but aren't]

## Recommendations
[Specific changes to negotiate before signing]

## Risk Level
[Low / Medium / High — with explanation]

IMPORTANT: This is not legal advice. Always consult a qualified entertainment attorney before signing any contract.`,

  royalty_estimator: ({ royaltyPlatform, royaltyPlays, royaltyDeal }) =>
    `You are a music business consultant. Estimate royalties for:

Platform: ${royaltyPlatform}
Streams/Plays: ${royaltyPlays}
Deal Type: ${royaltyDeal}

Provide:

## Royalty Estimate

### Per-Stream Rate
[Typical rate for ${royaltyPlatform} — explain the range]

### Gross Revenue
[Total revenue before splits]

### Label/Publisher Split
[How the money gets divided based on ${royaltyDeal} deal]

### Estimated Artist Payout
[What the artist actually receives]

## Breakdown Table
[Markdown table showing the math step by step]

## Context
[How this compares to industry standards]

## Important Notes
[What affects these numbers — geographic mix, subscription vs free tier, etc.]

Note: These are estimates based on industry averages. Actual payouts vary significantly based on many factors.`,

  budget_planner: ({ budgetType, budgetScale, budgetNotes }) =>
    `You are a production manager and budget consultant. Create a budget breakdown for:

Project Type: ${budgetType}
Scale: ${budgetScale}
Notes: ${budgetNotes || 'Standard production'}

Generate:

## Budget Overview
[Total estimated range and approach]

## Line Item Breakdown
[Markdown table with categories and estimated amounts]

| Category | Estimated Cost | % of Budget |
|----------|--------------|-------------|
[Fill in appropriate categories for ${budgetType}]

## Cost-Saving Tips
[5-8 practical ways to reduce costs without sacrificing quality]

## Hidden Costs to Watch
[Common overlooked expenses in ${budgetType} production]

## Recommended Priorities
[Where to splurge vs where to save]

## Funding Options
[Suggested funding sources based on ${budgetScale} scale]`,

  distribution_strategy: ({ distType, distMarket, distBudget }) =>
    `You are a music/film distribution strategist. Create a distribution strategy for:

Project Type: ${distType}
Target Market: ${distMarket}
Budget: ${distBudget}

Generate:

## Distribution Plan Overview
[Strategy summary]

## Digital Distribution
[Platforms, aggregators, and timeline]

## Physical Distribution
[If applicable — vinyl, CD, DVD, etc.]

## Release Strategy
[Rollout plan — exclusive windows, staggered release, etc.]

## Market-Specific Approach
[How to reach ${distMarket} audience specifically]

## Playlist / Placement Strategy
[How to get on playlists, in stores, on shelves]

## Marketing Support
[What distribution needs to succeed]

## Timeline
[8-12 week distribution timeline]

## Key Partners
[Suggested aggregators, distributors, and partners for this budget range]`,

  merch_ideas: ({ merchProject, merchGenre, merchAudience }) =>
    `You are a merchandise strategist for the entertainment industry. Suggest merchandise concepts for:

Artist/Project: ${merchProject}
Genre/Vibe: ${merchGenre}
Target Audience: ${merchAudience || 'Core fanbase'}

Generate:

## Merch Concepts (8-10 ideas)
[Creative, on-brand merchandise ideas — mix of practical and creative]

For each item include:
- **Name:** [Product name]
- **Description:** [What it is]
- **Why It Works:** [Why fans would buy it]
- **Est. Price Range:** [Suggested retail]
- **Production Complexity:** [Low/Medium/High]

## Limited Edition Ideas
[2-3 premium/scarcity items]

## Collaborations
[Suggested brand or artist collabs that fit the vibe]

## Sales Channels
[Where to sell — tour, online, retail]

## Launch Strategy
[How to roll out merch with a release or tour]`,
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    const groqKey = await getEnvVar('GROQ_API_KEY')
    const geminiKey = await getEnvVar('GEMINI_API_KEY')
    setGeminiApiKey(geminiKey)
    const openrouterKey = await getEnvVar('OPENROUTER_API_KEY')
    setOpenrouterApiKey(openrouterKey)
    const groqClient = await getPrimaryClientAsync(groqKey)
    if (!groqClient) {
      return Response.json({ error: 'AI service not configured' }, { status: 503 })
    }
    const { tool, payload } = await req.json()
    const promptFn = PROMPTS[tool]
    if (!promptFn) {
      return Response.json({ error: 'Invalid tool' }, { status: 400 })
    }

    const chat = await groqChat({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a world-class creative AI assistant integrated into Kivora ReelPen, a professional toolkit for musicians, filmmakers, and entertainers. You produce output that is vivid, emotionally resonant, and immediately usable — never generic, never padded, never clichéd. Write like a seasoned industry professional who has studied the greatest films, series, albums, and campaigns ever made. Use rich markdown: **bold** for emphasis, headings for structure, blockquotes for key insights, and tables for comparisons. Every response should feel like it came from a creative director at the top of their craft.'
        },
        {
          role: 'user',
          content: promptFn(payload || {})
        }
      ]
    })

    return Response.json({ result: chat.choices[0].message.content })
  } catch (err) {
    console.error('[reelpen]', err)
    if (err instanceof GroqError && err.code === 'GROQ_QUOTA_EXCEEDED') {
      return Response.json({ error: 'Too many requests, try again later.', quotaExceeded: true }, { status: 429 })
    }
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
