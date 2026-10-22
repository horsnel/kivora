// v5.22 — per-post route so sharing a single community post carries its own
// Open Graph card (title + excerpt + first image attachment). Scrapers get
// server-rendered meta; humans get the client view with the same styling the
// feed uses (markdown + code blocks + attachments).
import { getSupabaseAdmin } from '@/lib/supabase'
import SinglePostView from '@/components/SinglePostView'
import { notFound } from 'next/navigation'

// Required for Cloudflare Pages edge runtime (same as app/explore/[slug])
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

function stripMd(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function getPost(id) {
  if (!/^[0-9a-f-]{16,40}$/i.test(String(id))) return null
  try {
    const admin = getSupabaseAdmin()
    if (!admin) return null
    const { data } = await admin
      .from('forum_posts')
      .select('id, title, body, attachments, author_name, user_id, created_at')
      .eq('id', id)
      .single()
    return data || null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }) {
  const post = await getPost(params?.id)
  if (!post) return { title: 'Post not found', robots: { index: false } }

  const excerpt = stripMd(post.body).slice(0, 180)
  const images = (Array.isArray(post.attachments) ? post.attachments : []).filter(a => a.kind === 'image' && a.url)

  return {
    title: post.title || 'Community post',
    description: excerpt || 'A post from the Kivora community.',
    openGraph: {
      title: post.title || 'Community post',
      description: excerpt || 'A post from the Kivora community.',
      type: 'article',
      siteName: 'Kivora',
      publishedTime: post.created_at || undefined,
      images: images.length
        ? [{ url: images[0].url, alt: post.title || 'Post attachment' }]
        : [{ url: 'https://kivora.pages.dev/og.png', width: 1200, height: 630, alt: 'Kivora' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title || 'Community post',
      description: excerpt || 'A post from the Kivora community.',
      images: images.length ? [images[0].url] : ['https://kivora.pages.dev/og.png'],
    },
  }
}

export default async function CommunityPostPage({ params }) {
  const post = await getPost(params?.id)
  if (!post) notFound()
  return <SinglePostView postId={params.id} initialTitle={post.title} />
}
