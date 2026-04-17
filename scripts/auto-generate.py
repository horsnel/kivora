#!/usr/bin/env python3
"""
MenshlyGlobal — Auto Article Generator
Generates articles via AI API and outputs Hugo markdown.
Called by GitHub Actions cron workflow.

Required env vars:
  AI_API_KEY  — Cerebras / compatible API key

Optional env vars:
  PEXELS_API_KEY  — Pexels API key for images (source 1)
  PIXABAY_API_KEY — Pixabay API key for images (source 2)
  FREPIK_API_KEY  — Freepik API key for images (source 3)
  NEWS_API_KEY    — NewsAPI.org key for trending topic inspiration
  AI_API_BASE     — API base URL (default: https://api.cerebras.ai/v1)
  AI_MODEL        — Model name (default: llama-3.3-70b)
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
def _clean(val):
    """Strip invisible Unicode chars that break HTTP headers (e.g. copy-paste LRM/RLO)."""
    # Remove invisible control chars: LRM (U+200E), RLM (U+200F), BOM (U+FEFF), zero-width chars, etc.
    return re.sub(r'[\u200b-\u200f\u2028-\u202e\ufeff\u00ad]', '', val).strip()

API_KEY = _clean(os.environ.get("AI_API_KEY", ""))
API_BASE = _clean((os.environ.get("AI_API_BASE") or "https://api.cerebras.ai/v1")).rstrip("/")
MODEL = _clean(os.environ.get("AI_MODEL") or "llama-3.3-70b")
PEXELS_KEY = _clean(os.environ.get("PEXELS_API_KEY", ""))
PIXABAY_KEY = _clean(os.environ.get("PIXABAY_API_KEY", ""))
FREPIK_KEY = _clean(os.environ.get("FREPIK_API_KEY", ""))
NEWS_API_KEY = _clean(os.environ.get("NEWS_API_KEY", ""))
MANUAL_CATEGORY = _clean(os.environ.get("MANUAL_CATEGORY", ""))
MANUAL_TOPIC = _clean(os.environ.get("MANUAL_TOPIC", ""))

if not API_KEY:
    _err("AI_API_KEY not set. Add it in GitHub Secrets.")

# ── Debug: print config (never expose secrets) ──────────────
print(f"DEBUG — API_BASE: {API_BASE}")
print(f"DEBUG — MODEL: '{MODEL}' (len={len(MODEL)})")
print(f"DEBUG — API_KEY: {API_KEY[:6]}...{API_KEY[-4:]} (len={len(API_KEY)})")
print(f"DEBUG — PEXELS: {'set' if PEXELS_KEY else 'not set'}")
print(f"DEBUG — PIXABAY: {'set' if PIXABAY_KEY else 'not set'}")
print(f"DEBUG — FREPIK: {'set' if FREPIK_KEY else 'not set'}")
print(f"DEBUG — NEWSAPI: {'set' if NEWS_API_KEY else 'not set'}")

# ── Auto-detect best available model ────────────────────────
# Priority order: prefer larger models for quality
MODEL_PREFERENCES = [
    "llama3.1-70b", "llama-3.3-70b", "llama3.1-8b",
    "gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507",
    "zai-glm-4.7"
]

def auto_detect_model():
    """Query the API for available models and pick the best one."""
    try:
        req = urllib.request.Request(
            API_BASE + "/models",
            headers={
                "Authorization": "Bearer " + API_KEY,
                "User-Agent": "MenshlyGlobal/1.0 (Bot; +https://menshly-global.pages.dev)"
            }
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        available = [m["id"] for m in data.get("data", [])]
        print(f"DEBUG — Available models: {', '.join(available)}")

        # If user-specified model exists, use it
        if MODEL in available:
            print(f"DEBUG — Using configured model: {MODEL}")
            return MODEL

        # Otherwise pick the best from our preference list
        for pref in MODEL_PREFERENCES:
            if pref in available:
                print(f"DEBUG — '{MODEL}' not found. Auto-selected: {pref}")
                return pref

        # Last resort: use first available
        fallback = available[0] if available else MODEL
        print(f"DEBUG — Using fallback model: {fallback}")
        return fallback
    except Exception as e:
        print(f"DEBUG — Could not list models ({e}). Using: {MODEL}")
        return MODEL

ACTIVE_MODEL = auto_detect_model()

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
        "newsapi_q": "entertainment OR movies OR music OR celebrity",
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
        "newsapi_q": "personal finance OR investing OR money OR savings",
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
        "newsapi_q": "technology OR AI OR smartphone OR startup",
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
        "newsapi_q": "business OR entrepreneurship OR startup OR economy",
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
        "newsapi_q": "health OR wellness OR fitness OR mental health",
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
        "newsapi_q": "science OR space OR research OR discovery",
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
        "newsapi_q": "world OR Africa OR global OR international",
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

# ── Image search keywords per category ─────────────────────
IMAGE_KEYWORDS = {
    "entertainment": ["cinema", "music concert", "celebrity", "film set", "stage performance", "movie theater", "red carpet"],
    "finance": ["finance", "money savings", "investment chart", "banking", "wallet coins", "stock market", "gold coins"],
    "technology": ["technology", "computer laptop", "digital innovation", "smartphone", "coding", "circuit board", "robot"],
    "business": ["business meeting", "office corporate", "entrepreneur", "startup team", "handshake", "office desk", "corporate"],
    "health": ["health fitness", "yoga wellness", "healthy food", "medical care", "exercise", "running", "meditation"],
    "science": ["science laboratory", "space galaxy", "microscope research", "chemistry", "nature", "telescope", "DNA"],
    "world": ["world map globe", "city skyline", "diverse culture", "african landscape", "travel", "earth from space", "global"]
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

def safe_fetch_json(url, headers=None, timeout=15):
    """Fetch JSON from URL — returns None on failure instead of crashing."""
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"  Fetch failed: {e}")
        return None

def build_image_query(topic, category_key):
    """Build a smart image search query from topic + category keywords."""
    keywords = IMAGE_KEYWORDS.get(category_key, ["media"])
    keyword = random.choice(keywords)
    topic_words = " ".join(topic.split()[:4])
    return f"{keyword} {topic_words}"

def score_image_relevance(photo_data, topic, category_key):
    """Score how relevant an image is to the topic (0-100)."""
    score = 50  # Base score

    # Check if tags/description match topic words
    topic_lower = topic.lower()
    topic_words = set(topic_lower.split())

    # Extract text from the photo data
    tags = []
    description = ""

    if isinstance(photo_data, dict):
        if photo_data.get("tags"):
            tags = [str(t).lower() for t in photo_data["tags"]]
        if photo_data.get("description"):
            description = str(photo_data["description"]).lower()
        if photo_data.get("alt"):
            description += " " + str(photo_data["alt"]).lower()

    all_text = " ".join(tags) + " " + description

    # +15 for each topic word found in image metadata
    for word in topic_words:
        if len(word) > 3 and word in all_text:
            score += 15

    # Category keyword match
    cat_keywords = IMAGE_KEYWORDS.get(category_key, [])
    for kw in cat_keywords[:3]:
        if kw in all_text:
            score += 5

    # Penalize if the image has no useful metadata at all
    if not tags and not description:
        score -= 20

    return min(score, 100)


# ── Pexels Image Source ────────────────────────────────────
def fetch_pexels_image(topic, category_key):
    """Source 1: Fetch image from Pexels."""
    if not PEXELS_KEY:
        return None

    query = build_image_query(topic, category_key)
    url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(query)}&per_page=5&orientation=landscape"

    print(f"  [Pexels] Searching: {query}")
    data = safe_fetch_json(url, headers={"Authorization": PEXELS_KEY}, timeout=15)
    if not data or not data.get("photos"):
        print("  [Pexels] No results")
        return None

    # Score top 5 results and pick the best
    best = None
    best_score = 0
    for photo in data["photos"][:5]:
        s = score_image_relevance(photo, topic, category_key)
        if s > best_score:
            best_score = s
            best = photo

    if best:
        print(f"  [Pexels] Best match scored {best_score}/100")
        return {
            "url": best["src"]["large"],
            "thumb": best["src"]["medium"],
            "credit": best["photographer"],
            "credit_url": best["photographer_url"],
            "source": "Pexels",
            "score": best_score
        }
    return None


# ── Pixabay Image Source ───────────────────────────────────
def fetch_pixabay_image(topic, category_key):
    """Source 2: Fetch image from Pixabay."""
    if not PIXABAY_KEY:
        return None

    query = build_image_query(topic, category_key)
    url = f"https://pixabay.com/api/?key={PIXABAY_KEY}&q={urllib.parse.quote(query)}&image_type=photo&orientation=horizontal&per_page=5&safesearch=true"

    print(f"  [Pixabay] Searching: {query}")
    data = safe_fetch_json(url, timeout=15)
    if not data or not data.get("hits"):
        print("  [Pixabay] No results")
        return None

    # Score top 5 and pick best
    best = None
    best_score = 0
    for hit in data["hits"][:5]:
        s = score_image_relevance(hit, topic, category_key)
        if s > best_score:
            best_score = s
            best = hit

    if best:
        print(f"  [Pixabay] Best match scored {best_score}/100")
        # Pick large image, fallback to webformatURL
        img_url = best.get("largeImageURL") or best.get("webformatURL", "")
        if not img_url:
            return None
        return {
            "url": img_url,
            "thumb": best.get("webformatURL", img_url),
            "credit": best.get("user", "Pixabay User"),
            "credit_url": f"https://pixabay.com/users/{best.get('user_id', '')}-{best.get('user', '')}/",
            "source": "Pixabay",
            "score": best_score
        }
    return None


# ── Freepik Image Source ───────────────────────────────────
def fetch_freepik_image(topic, category_key):
    """Source 3: Fetch image from Freepik API."""
    if not FREPIK_KEY:
        return None

    query = build_image_query(topic, category_key)
    url = f"https://api.freepik.com/v1/resources?locale=en-US&phrase={urllib.parse.quote(query)}&image_type=photo&orientation=landscape&limit=5&order=relevance"

    print(f"  [Freepik] Searching: {query}")
    data = safe_fetch_json(url, headers={
        "Accept-Language": "en-US",
        "Accept": "application/json",
        "Authorization": f"Bearer {FREPIK_KEY}"
    }, timeout=15)

    if not data or not data.get("data"):
        print("  [Freepik] No results")
        return None

    best = None
    best_score = 0
    for item in data["data"][:5]:
        s = score_image_relevance(item, topic, category_key)
        if s > best_score:
            best_score = s
            best = item

    if best:
        print(f"  [Freepik] Best match scored {best_score}/100")
        # Extract best image URL from Freepik response
        thumbs = best.get("thumbnails", [])
        img_url = ""
        for t in thumbs:
            if t.get("width", 0) >= 1280:
                img_url = t.get("url", "")
                break
        if not img_url and thumbs:
            img_url = thumbs[-1].get("url", "")
        if not img_url:
            return None

        thumb_url = thumbs[0].get("url", img_url) if thumbs else img_url

        return {
            "url": img_url,
            "thumb": thumb_url,
            "credit": best.get("creator", {}).get("name", "Freepik Contributor"),
            "credit_url": best.get("creator", {}).get("url", ""),
            "source": "Freepik",
            "score": best_score
        }
    return None


# ── Unified image fetcher with fallback chain ──────────────
def fetch_best_image(topic, category_key):
    """Try all 3 image sources, pick the highest-scoring result."""
    print(f"\nSearching images for: {topic}")

    candidates = []

    # Source 1: Pexels
    pexels_result = fetch_pexels_image(topic, category_key)
    if pexels_result:
        candidates.append(pexels_result)

    # Source 2: Pixabay
    pixabay_result = fetch_pixabay_image(topic, category_key)
    if pixabay_result:
        candidates.append(pixabay_result)

    # Source 3: Freepik
    freepik_result = fetch_freepik_image(topic, category_key)
    if freepik_result:
        candidates.append(freepik_result)

    if not candidates:
        print("  No images found from any source")
        return None

    # Pick the highest scoring image
    candidates.sort(key=lambda x: x.get("score", 0), reverse=True)
    winner = candidates[0]
    print(f"  Winner: {winner['source']} (score {winner.get('score', 0)}/100)")
    print(f"  Photo by: {winner['credit']}")
    return winner


# ── NewsAPI trending topic inspiration ─────────────────────
def get_trending_from_newsapi(category_key):
    """Use NewsAPI to find trending headlines for topic inspiration."""
    if not NEWS_API_KEY:
        return None

    cat_info = CATEGORIES.get(category_key, {})
    query = cat_info.get("newsapi_q", category_key)

    # Only grab from the last 3 days to keep it fresh
    from_date = (datetime.now(timezone.utc) - __import__('datetime').timedelta(days=3)).strftime("%Y-%m-%d")

    url = (
        f"https://newsapi.org/v2/everything?"
        f"q={urllib.parse.quote(query)}"
        f"&language=en"
        f"&sortBy=publishedAt"
        f"&pageSize=10"
        f"&from={from_date}"
        f"&apiKey={NEWS_API_KEY}"
    )

    print(f"  [NewsAPI] Fetching trends for: {query}")
    data = safe_fetch_json(url, timeout=15)

    if not data or data.get("status") != "ok" or not data.get("articles"):
        print(f"  [NewsAPI] No results: {data.get('message', 'unknown') if data else 'fetch failed'}")
        return None

    # Extract headline themes — convert to opinion/analysis angles
    headlines = []
    for article in data["articles"][:10]:
        title = article.get("title", "").strip()
        if title and len(title) > 15:
            headlines.append(title)

    if not headlines:
        return None

    # Pick a random headline and convert to an opinion/analysis topic
    chosen_headline = random.choice(headlines)
    print(f"  [NewsAPI] Trending headline: {chosen_headline}")

    # Convert to analysis/opinion angle
    analysis_topics = [
        f"An analysis of: {chosen_headline}",
        f"What {chosen_headline} means for the future",
        f"Expert take: why {chosen_headline} matters",
        f"The bigger picture behind {chosen_headline}",
        f"Understanding the implications of {chosen_headline}",
    ]
    return random.choice(analysis_topics)


# ── Topic picking ──────────────────────────────────────────
def pick_topic(category_key):
    """Pick a topic: try NewsAPI first, fallback to curated pool."""
    # Try NewsAPI for trending inspiration (50% chance to use it)
    if NEWS_API_KEY and random.random() < 0.5:
        newsapi_topic = get_trending_from_newsapi(category_key)
        if newsapi_topic:
            return newsapi_topic

    # Fallback to curated topic pool
    topics = CATEGORIES[category_key]["topics"]
    try:
        with open("output/recent_topics.json", "r") as f:
            recent = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        recent = []

    available = [t for t in topics if t not in recent]
    if not available:
        available = topics[:]

    chosen = random.choice(available)

    recent.append(chosen)
    recent = recent[-30:]
    os.makedirs("output", exist_ok=True)
    with open("output/recent_topics.json", "w") as f:
        json.dump(recent, f)

    return chosen


# ── AI Article Generation ──────────────────────────────────
def generate_article(topic, category_key, category_label):
    """Call AI API to generate an article."""
    print(f"\nGenerating article: [{category_label}] {topic}")

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
        "model": ACTIVE_MODEL,
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
            "Authorization": "Bearer " + API_KEY,
            "User-Agent": "MenshlyGlobal/1.0 (Bot; +https://menshly-global.pages.dev)"
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
        article = {
            "title": topic,
            "summary": raw[:200],
            "content": raw
        }

    return article


# ── Build Hugo Markdown ───────────────────────────────────
def build_markdown(article, topic, category_key, category_label, image_data):
    """Convert article to Hugo markdown with front matter."""
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    slug = slugify(article.get("title", topic))
    author = random.choice(AUTHORS)
    title = article.get("title", topic).strip().replace('"', "'")

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

    if image_data:
        fm_lines.append(f'image: "{image_data["url"]}"')

    fm_lines.extend([
        f'categories: ["{category_key}"]',
        f'tags: {json.dumps(tags)}',
        f'author: "{author}"',
        f'description: "{article.get("summary", "")[:160].replace(chr(34), "")}"',
        "---",
        "",
    ])

    body = article.get("summary", "") + "\n\n" + article.get("content", "")
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

    # Fetch best image from all 3 sources
    image_data = fetch_best_image(topic, category_key)

    # Build markdown
    markdown, slug = build_markdown(article, topic, category_key, category_label, image_data)

    # Check for duplicate slugs
    post_path = f"content/posts/{slug}.md"
    if os.path.exists(post_path):
        print(f"\nArticle '{slug}' already exists — skipping to avoid overwrite.")
        os.makedirs("output", exist_ok=True)
        open("output/article.md", "w").close()
        return

    # Write output
    os.makedirs("output", exist_ok=True)
    with open("output/article.md", "w") as f:
        f.write(markdown)

    img_info = f" | Image: {image_data['source']} by {image_data['credit']}" if image_data else ""
    print(f"\nArticle saved: output/article.md{img_info}")
    print(f"Will be committed to: {post_path}")


if __name__ == "__main__":
    main()
