import { supabaseAdmin } from '@/lib/supabase'
import { groq, MODEL, MODEL_FAST } from '@/lib/groq'

export async function POST(req) {
  try {
    const { title, content, category, date } = await req.json()
    if (!title || !content) {
      return Response.json({ error: 'title and content required' }, { status: 400 })
    }

    const articleDate = date || new Date().toISOString().slice(0, 10)

    // Extract entities and summary
    const extractChat = await groq.chat.completions.create({
      model: MODEL_FAST,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Extract structured knowledge from content for a wiki knowledge base.
Respond ONLY with valid JSON — no markdown, no explanation.`
        },
        {
          role: 'user',
          content: `Title: ${title}
Category: ${category || 'general'}
Content: ${content.slice(0, 2500)}

Return JSON:
{
  "summary": "2-3 sentence summary of the key information",
  "entities": [
    {
      "slug": "kebab-case-unique-identifier",
      "type": "person|org|topic|concept|tool|place",
      "name": "Display Name",
      "relevance": "How this entity relates to the content"
    }
  ]
}`
        }
      ]
    })

    let extracted
    try {
      const raw = extractChat.choices[0].message.content.trim()
        .replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
      extracted = JSON.parse(raw)
    } catch {
      return Response.json({ error: 'Failed to extract entities' }, { status: 500 })
    }

    // Create article summary page
    const articleSlug = `article-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${articleDate}`
    await supabaseAdmin.from('wiki_pages').upsert({
      slug: articleSlug,
      title,
      content: `# ${title}\n\n**Date:** ${articleDate}\n**Category:** ${category}\n\n## Summary\n${extracted.summary}\n\n## Entities\n${(extracted.entities || []).map(e => `- [[${e.slug}]] — ${e.name}`).join('\n')}\n`,
      updated_at: new Date().toISOString()
    }, { onConflict: 'slug' })

    // Update or create entity pages
    const entityUpdates = await Promise.allSettled(
      (extracted.entities || []).map(async (entity) => {
        const { data: existing } = await supabaseAdmin
          .from('wiki_pages')
          .select('content')
          .eq('slug', entity.slug)
          .single()

        const pageChat = await groq.chat.completions.create({
          model: MODEL_FAST,
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: `You maintain wiki pages for Kivora.
Write clean, factual markdown. Use [[slug]] syntax for crosslinks.
Respond ONLY with the markdown content — no explanation.`
            },
            {
              role: 'user',
              content: existing
                ? `Update this wiki page for "${entity.name}". Add new info without removing existing.

EXISTING PAGE:
${existing.content.slice(0, 1500)}

NEW INFO from article: "${title}" (${articleDate})
New context: ${entity.relevance}
Summary: ${extracted.summary}

Rules: preserve all existing info, add to ## Coverage section, mark contradictions with ⚠️`
                : `Create a new wiki page for "${entity.name}" (type: ${entity.type}).

First mentioned in: "${title}" (${articleDate})
Context: ${entity.relevance}
Summary: ${extracted.summary}

Include these sections:
## Overview
## Key Facts
## Coverage
## Related`
            }
          ]
        })

        const pageContent = pageChat.choices[0].message.content.trim()
        await supabaseAdmin.from('wiki_pages').upsert({
          slug: entity.slug,
          title: entity.name,
          content: pageContent,
          updated_at: new Date().toISOString()
        }, { onConflict: 'slug' })

        return entity.slug
      })
    )

    // Rebuild index
    const { data: allPages } = await supabaseAdmin
      .from('wiki_pages')
      .select('slug, title, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500)

    const indexContent = [
      '# Kivora Wiki Index',
      `_Last updated: ${new Date().toISOString()}_`,
      `_Total pages: ${allPages?.length || 0}_`,
      '',
      '## Pages',
      ...(allPages || []).map(p =>
        `- [[${p.slug}]] — ${p.title} _(${p.updated_at?.slice(0, 10)})_`
      )
    ].join('\n')

    await supabaseAdmin.from('wiki_index').upsert(
      { id: 1, content: indexContent, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )

    // Append to log
    const { data: log } = await supabaseAdmin
      .from('wiki_log').select('content').eq('id', 1).single()
    const logEntry = `## [${articleDate}] ingest | ${title} | ${extracted.entities?.length || 0} entities\n\n`
    await supabaseAdmin.from('wiki_log').upsert({
      id: 1,
      content: logEntry + (log?.content || ''),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })

    const succeeded = entityUpdates.filter(r => r.status === 'fulfilled').length

    return Response.json({
      success: true,
      article_slug: articleSlug,
      entities_updated: succeeded,
      summary: extracted.summary
    })
  } catch (err) {
    console.error('[wiki/ingest]', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
