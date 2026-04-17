#!/usr/bin/env python3
"""
MenshlyGlobal — Auto Article Generator
Generates articles via AI API and outputs Hugo markdown.
Called by GitHub Actions cron workflow.

Required env vars:
  AI_API_KEY  — Cerebras / compatible API key
Optional env vars:
  PEXELS_API_KEY — Pexels API key for images
  AI_API_BASE    — API base URL (default: https://api.cerebras.ai/v1)
  AI_MODEL       — Model name (default: llama-3.3-70b)
  MANUAL_CATEGORY — Override category (from workflow_dispatch)
  MANUAL_TOPIC    — Override topic (from workflow_dispatch)
"""

import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
import ssl
from datetime import datetime, timezone

# ── Configuration ──────────────────────────────────────────
API_KEY = os.environ.get("AI_API_KEY", "")
API_BASE = (os.environ.get("AI_API_BASE") or "https://api.cerebras.ai/v1").rstrip("/")
MODEL = os.environ.get("AI_MODEL") or "llama-3.3-70b"
PEXELS_KEY = os.environ.get("PEXELS_API_KEY", "")
MANUAL_CATEGORY = os.environ.get("MANUAL_CATEGORY", "")
MANUAL_TOPIC = os.environ.get("MANUAL_TOPIC", "")

if not API_KEY:
    _err("AI_API_KEY not set. Add it in GitHub Secrets.")

# ── Authors pool ───────────────────────────────────────────
AUTHORS = [
    "David Kiprop", "Sarah Mitchell", "Amara Okonkwo", "Marcus Webb",
    "James Chen", "Dr. Elena Vasquez", "Dr. Fatima Al-Hassan"
]

# ── Categories & topics ────────────────────────────────────
CATEGORIES = {
    "entertainment": {
        "label": "Entertainment",
        "url": "/categories/entertainment",
        "topics": [
            "The evolution of Afrobeats on the global stage in 2026",
            "How streaming platforms changed African cinema forever",
            "Best upcoming movies to watch this month",
            "The rise of Nollywood and its $1 billion valuation",
            "K-pop influence on African pop culture",
            "Top 10 must-see series releasing this quarter",
            "How TikTok is reshaping the music industry",
            "The comeback of live concerts and music festivals",
            "Why African animations are gaining worldwide recognition",
            "Celebrity entrepreneurs building entertainment empires",
            "The impact of AI on film production and visual effects",
            "How social media created a new generation of influencers"
        ]
    },
    "finance": {
        "label": "Finance",
        "url": "/categories/finance",
        "topics": [
            "5 side hustles that can earn you $500 a month in 2026",
            "How to start investing with just $50",
            "Best high-yield savings accounts for beginners",
            "The complete guide to building an emergency fund",
            "Passive income ideas that actually work in Africa",
            "How to save money on a low income — practical tips",
            "Freelancing in 2026: top platforms and how to get started",
            "How to build multiple streams of income before age 30",
            "The best budgeting apps and tools for 2026",
            "How to monetize your skills online — a beginner guide",
            "Real estate vs stocks: where to invest $10,000",
            "How to negotiate a higher salary at your current job",
            "Digital products you can sell for passive income",
            "The gig economy in Africa: opportunities and challenges",
            "How compound interest can make you wealthy over time"
        ]
    },
    "technology": {
        "label": "Technology",
        "url": "/categories/technology",
        "topics": [
            "Best productivity apps for remote workers in 2026",
            "How AI tools are changing everyday life for ordinary people",
            "The future of electric vehicles in African markets",
            "Cybersecurity tips everyone should know in 2026",
            "How to protect your privacy online — a practical guide",
            "Top smartphones under $300 worth buying this year",
            "The rise of fintech and mobile money in Africa",
            "How 5G networks are transforming connectivity",
            "Best laptops for students and professionals on a budget",
            "How blockchain technology goes beyond cryptocurrency",
            "The impact of AI on job markets — what to expect",
            "Smart home gadgets that are actually worth buying",
            "How to start a tech blog or YouTube channel",
            "The best free software alternatives to expensive tools",
            "How social media algorithms work and how to use them"
        ]
    },
    "business": {
        "label": "Business",
        "url": "/categories/business",
        "topics": [
            "Small business ideas with low startup costs in 2026",
            "How to start an e-commerce store from scratch",
            "The state of African startup ecosystems this year",
            "How to build a personal brand that attracts clients",
            "Lessons from the most successful African entrepreneurs",
            "How to write a business plan that investors will fund",
            "The best marketing strategies for small businesses",
            "How to scale a side hustle into a full-time business",
            "Remote work trends and what they mean for companies",
            "How to negotiate better deals in business",
            "The rise of sustainable and green businesses in Africa",
            "How to build a loyal customer base from zero",
            "Top business books every entrepreneur should read",
            "How digital marketing has evolved in 2026",
            "How to register and start a business in Nigeria"
        ]
    },
    "health": {
        "label": "Health",
        "url": "/categories/health",
        "topics": [
            "Simple daily habits that dramatically improve your health",
            "Mental health awareness: signs you should not ignore",
            "Best home workouts that require zero equipment",
            "How to eat healthy on a tight budget",
            "The importance of sleep and how to get better rest",
            "Understanding common health myths vs facts",
            "How stress affects your body and practical ways to manage it",
            "The benefits of walking 10,000 steps a day",
            "How to stay hydrated and why it matters more than you think",
            "Best superfoods to add to your diet in 2026",
            "How to build a consistent workout routine as a beginner",
            "The link between gut health and mental wellbeing",
            "Simple meditation techniques for busy people",
            "How to reduce screen time and protect your eyes",
            "Why regular health checkups could save your life"
        ]
    },
    "science": {
        "label": "Science",
        "url": "/categories/science",
        "topics": [
            "Recent breakthroughs in renewable energy technology",
            "How space exploration is advancing in 2026",
            "The science behind climate change and what you can do",
            "Fascinating discoveries about the deep ocean",
            "How CRISPR gene editing is transforming medicine",
            "The future of quantum computing explained simply",
            "Amazing facts about the human brain you probably didn't know",
            "How vaccines work and the latest developments",
            "The search for extraterrestrial life — latest updates",
            "How artificial intelligence is accelerating scientific research",
            "The science of nutrition: what actually works",
            "Incredible animal adaptations that inspire technology",
            "How robotics is changing surgery and healthcare",
            "The role of fungi in ecosystems and medicine",
            "Understanding the microbiome and its impact on health"
        ]
    },
    "world": {
        "label": "World",
        "url": "/categories/world",
        "topics": [
            "How climate migration is reshaping global populations",
            "The growing influence of African nations on the world stage",
            "Education systems around the world: what works and what doesn't",
            "How cities of the future are being designed today",
            "The global water crisis and innovative solutions",
            "How digital currencies could change cross-border trade",
            "The future of democracy in the digital age",
            "How cultural exchange programs bridge global divides",
            "The most livable cities in Africa in 2026",
            "How renewable energy is transforming developing nations",
            "The rise of remote work and digital nomad communities",
            "How global supply chains are being restructured",
            "The impact of population growth on urban planning",
            "How sports diplomacy is connecting nations",
            "The evolution of global trade agreements in 2026"
        ]
    }
}

# ── Category-to-Pexels keywords ────────────────────────────
PEXELS_KEYWORDS = {
    "entertainment": ["cinema", "music concert", "celebrity", "film set", "stage performance"],
    "finance": ["finance", "money savings", "investment chart", "banking", "wallet coins"],
    "technology": ["technology", "computer laptop", "digital innovation", "smartphone", "coding"],
    "business": ["business meeting", "office corporate", "entrepreneur", "startup team", "handshake"],
    "health": ["health fitness", "yoga wellness", "healthy food", "medical care", "exercise"],
    "science": ["science laboratory", "space galaxy", "microscope research", "chemistry", "nature"],
    "world": ["world map globe", "city skyline", "diverse culture", "african landscape", "travel"]
}

# ── Utility functions ──────────────────────────────────────
def _err(msg):
    os.makedirs("output", exist_ok=True)
    with open("output/error.log", "w") as f:
        f.write(msg + "\n")
    print(f"ERROR: {msg}")
    sys.exit(1)

def slugify(text):
    """Convert text to URL-safe slug."""
    s = text.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    s = s.strip('-')
    return s[:80] if len(s) > 80 else s

def fetch_json(url, headers=None, timeout=30):
    """Fetch JSON from URL."""
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return json.loads(resp.read().decode())

def pick_topic(category):
    """Pick a random topic, avoiding recent ones."""
    topics = CATEGORIES[category]["topics"]
    try:
        with open("output/recent_topics.json", "r") as f:
            recent = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        recent = []

    # Filter out recently used topics
    available = [t for t in topics if t not in recent]
    if not available:
        available = topics[:]  # Reset if all used

    chosen = random.choice(available)

    # Save to recent (keep last 30)
    recent.append(chosen)
    recent = recent[-30:]
    os.makedirs("output", exist_ok=True)
    with open("output/recent_topics.json", "w") as f:
        json.dump(recent, f)

    return chosen

# ── AI Article Generation ──────────────────────────────────
def generate_article(topic, category_key, category_label):
    """Call AI API to generate an article."""
    print(f"Generating article: [{category_label}] {topic}")

    tone = random.choice([
        "detailed review with clear verdict and actionable takeaways",
        "in-depth analytical breakdown with data-driven insights",
        "practical how-to guide with actionable steps",
        "thought-provoking opinion editorial with strong perspective",
        "engaging numbered list format with punchy entries",
        "engaging long-form feature with storytelling"
    ])

    lengths = ["300-400", "500-700", "700-900"]
    length = random.choice(lengths)

    system_prompt = f"""You are a content creator for MenshlyGlobal, a premium international media platform. You write ONLY reviews, analysis, opinions, guides, and commentary. You NEVER write breaking news or factual news reporting.

CRITICAL RULES:
- Write in {tone} style
- Target length: {length} words
- Category: {category_label}
- This is an OPINION/REVIEW piece, not a news article
- Include a compelling, SEO-friendly headline (max 12 words)
- Include a 1-2 sentence summary/standfirst
- Use markdown subheadings (##) for structure
- Be specific with concrete examples, numbers, and real-world references
- Never claim to report facts that need verification
- End with a clear conclusion or actionable takeaway
- Return ONLY valid JSON with these exact keys:
  "title": string (headline),
  "summary": string (1-2 sentences),
  "content": string (full article body in markdown with ## headings, paragraphs, bullet points)"""

    user_prompt = f"Write a {category_label} piece about: \"{topic}\""

    body = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": 3000,
        "temperature": 0.8,
        "response_format": {"type": "json_object"}
    }).encode()

    req = urllib.request.Request(
        API_BASE + "/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + API_KEY
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else "No details"
        _err(f"AI API error {e.code}: {error_body}")
    except urllib.error.URLError as e:
        _err(f"AI API connection error: {e.reason}")

    raw = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not raw:
        _err("AI returned empty response")

    try:
        article = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: wrap raw text
        article = {
            "title": topic,
            "summary": raw[:200],
            "content": raw
        }

    return article

# ── Pexels Image ───────────────────────────────────────────
def fetch_pexels_image(topic, category_key):
    """Fetch a relevant image from Pexels."""
    if not PEXELS_KEY:
        return None

    keywords = PEXELS_KEYWORDS.get(category_key, ["media"])
    keyword = random.choice(keywords)
    # Combine with first few words from topic
    topic_words = " ".join(topic.split()[:3])
    query = f"{keyword} {topic_words}"

    url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(query)}&per_page=1&orientation=landscape"

    try:
        req = urllib.request.Request(url, headers={"Authorization": PEXELS_KEY})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())

        if data.get("photos") and len(data["photos"]) > 0:
            photo = data["photos"][0]
            return {
                "url": photo["src"]["large"],
                "thumb": photo["src"]["medium"],
                "credit": photo["photographer"],
                "credit_url": photo["photographer_url"]
            }
    except Exception as e:
        print(f"Pexels fetch failed (non-fatal): {e}")

    return None

# ── Build Hugo Markdown ───────────────────────────────────
def build_markdown(article, topic, category_key, category_label):
    """Convert article to Hugo markdown with front matter."""
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    slug = slugify(article.get("title", topic))
    author = random.choice(AUTHORS)
    title = article.get("title", topic).strip()

    # Clean up quotes in title
    title = title.replace('"', "'")

    # Tags from topic words
    words = topic.lower().split()
    tags = random.sample(words, min(4, len(words)))
    tags.append("2026")
    tags.append("MenshlyGlobal")
    tags = list(set(tags))[:6]

    # Build front matter
    fm_lines = [
        "---",
        f'title: "{title}"',
        f'date: "{date_str}"',
        f'slug: "{slug}"',
    ]

    # Image from Pexels if available
    if hasattr(build_markdown, '_image') and build_markdown._image:
        fm_lines.append(f'image: "{build_markdown._image["url"]}"')

    fm_lines.extend([
        f'categories: ["{category_key}"]',
        f'tags: {json.dumps(tags)}',
        f'author: "{author}"',
        f'description: "{article.get("summary", "")[:160].replace(chr(34), "")}"',
        "---",
        "",
    ])

    # Content body — convert markdown to HTML for Hugo
    content = article.get("content", "")
    # Hugo renders markdown natively, so keep it as markdown
    # But wrap in proper structure

    body = article.get("summary", "") + "\n\n" + content

    full = "\n".join(fm_lines) + body

    return full, slug

# ── Main ───────────────────────────────────────────────────
def main():
    # Pick category
    cat_keys = list(CATEGORIES.keys())
    if MANUAL_CATEGORY and MANUAL_CATEGORY.lower() in CATEGORIES:
        category_key = MANUAL_CATEGORY.lower()
    else:
        category_key = random.choice(cat_keys)

    cat_info = CATEGORIES[category_key]
    category_label = cat_info["label"]

    # Pick topic
    if MANUAL_TOPIC and MANUAL_TOPIC.strip():
        topic = MANUAL_TOPIC.strip()
    else:
        topic = pick_topic(category_key)

    print(f"Category: {category_label}")
    print(f"Topic: {topic}")

    # Generate article
    article = generate_article(topic, category_key, category_label)
    print(f"Title: {article.get('title', 'No title')}")

    # Fetch image
    build_markdown._image = fetch_pexels_image(topic, category_key)
    if build_markdown._image:
        print(f"Image: {build_markdown._image['credit']} via Pexels")

    # Build markdown
    markdown, slug = build_markdown(article, topic, category_key, category_label)

    # Check for duplicate slugs
    post_path = f"content/posts/{slug}.md"
    if os.path.exists(post_path):
        print(f"Article '{slug}' already exists — skipping to avoid overwrite.")
        os.makedirs("output", exist_ok=True)
        open("output/article.md", "w").close()  # empty = skip commit
        return

    # Write output
    os.makedirs("output", exist_ok=True)
    with open("output/article.md", "w") as f:
        f.write(markdown)

    print(f"\nArticle saved: output/article.md")
    print(f"Will be committed to: {post_path}")

if __name__ == "__main__":
    main()
