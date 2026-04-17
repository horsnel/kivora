#!/usr/bin/env python3
"""
MenshlyGlobal — News Dispatch Generator
Generates CNN-style news dispatches for the homepage (content/posts/).
Called by GitHub Actions cron workflow.

Required env vars:
  AI_API_KEY  — AI API key (Cerebras / compatible)

Optional env vars:
  PEXELS_API_KEY  — Pexels API key for images
  PIXABAY_API_KEY — Pixabay API key for images
  FREPIK_API_KEY  — Freepik API key for images
  NEWS_API_KEY    — NewsAPI.org key for trending news
  AI_API_BASE     — API base URL (default: https://api.cerebras.ai/v1)
  AI_MODEL        — Model name (default: auto-detect)
  NEWS_COUNT      — Number of articles to generate (default: 3)
"""

import json
import os
import random
import re
import sys
import urllib.parse
import urllib.request
import urllib.error
import ssl
from datetime import datetime, timezone, timedelta

# ── Configuration ──────────────────────────────────────────
def _clean(val):
    """Strip invisible Unicode chars that break HTTP headers."""
    return re.sub(r'[\u200b-\u200f\u2028-\u202e\ufeff\u00ad]', '', val).strip()

API_KEY = _clean(os.environ.get("AI_API_KEY", ""))
API_BASE = _clean((os.environ.get("AI_API_BASE") or "https://api.cerebras.ai/v1")).rstrip("/")
MODEL = _clean(os.environ.get("AI_MODEL") or "")
PEXELS_KEY = _clean(os.environ.get("PEXELS_API_KEY", ""))
PIXABAY_KEY = _clean(os.environ.get("PIXABAY_API_KEY", ""))
FREPIK_KEY = _clean(os.environ.get("FREPIK_API_KEY", ""))
NEWS_API_KEY = _clean(os.environ.get("NEWS_API_KEY", ""))
NEWS_COUNT = int(os.environ.get("NEWS_COUNT", "3"))

if not API_KEY:
    _err("AI_API_KEY not set. Add it in GitHub Secrets.")

# ── Debug config ───────────────────────────────────────────
print(f"DEBUG — API_BASE: {API_BASE}")
print(f"DEBUG — PEXELS: {'set' if PEXELS_KEY else 'not set'}")
print(f"DEBUG — PIXABAY: {'set' if PIXABAY_KEY else 'not set'}")
print(f"DEBUG — FREPIK: {'set' if FREPIK_KEY else 'not set'}")
print(f"DEBUG — NEWSAPI: {'set' if NEWS_API_KEY else 'not set'}")
print(f"DEBUG — NEWS_COUNT: {NEWS_COUNT}")

# ── Model auto-detection ──────────────────────────────────
MODEL_PREFERENCES = [
    "qwen-3-235b-a22b-instruct-2507",
    "llama3.1-8b",
    "zai-glm-4.7"
]

def auto_detect_model():
    """Query the API for available models and pick the best one."""
    if MODEL:
        print(f"DEBUG — Using configured model: {MODEL}")
        return MODEL
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
        for pref in MODEL_PREFERENCES:
            if pref in available:
                print(f"DEBUG — Auto-selected: {pref}")
                return pref
        fallback = available[0] if available else "llama3.1-8b"
        print(f"DEBUG — Using fallback model: {fallback}")
        return fallback
    except Exception as e:
        print(f"DEBUG — Could not list models ({e}). Using: llama3.1-8b")
        return "llama3.1-8b"

ACTIVE_MODEL = auto_detect_model()

# ── Authors pool ───────────────────────────────────────────
AUTHORS = [
    "David Kiprop", "Sarah Mitchell", "Amara Okonkwo", "Marcus Webb",
    "James Chen", "Dr. Elena Vasquez", "Dr. Fatima Al-Hassan"
]

# ── Categories for news ───────────────────────────────────
NEWS_CATEGORIES = {
    "world": {
        "label": "World",
        "newsapi_q": "world news OR international OR geopolitics",
        "angles": [
            "diplomatic implications and global response",
            "economic impact on developing nations",
            "regional security and stability concerns",
            "humanitarian perspective and aid efforts",
            "historical context and lessons learned"
        ]
    },
    "technology": {
        "label": "Technology",
        "newsapi_q": "technology OR AI OR startup OR software OR hardware",
        "angles": [
            "industry disruption and market implications",
            "consumer impact and adoption timeline",
            "regulatory challenges and policy response",
            "competitive landscape and key players",
            "future roadmap and innovation pipeline"
        ]
    },
    "business": {
        "label": "Business",
        "newsapi_q": "business OR economy OR markets OR trade OR startup",
        "angles": [
            "market reaction and investor sentiment",
            "industry-wide implications and ripple effects",
            "strategic analysis and competitive positioning",
            "emerging opportunities and risk factors",
            "expert commentary and forward outlook"
        ]
    },
    "finance": {
        "label": "Finance",
        "newsapi_q": "finance OR stock market OR cryptocurrency OR banking OR investment",
        "angles": [
            "portfolio impact and investor strategy",
            "regulatory response and compliance implications",
            "macroeconomic indicators and trends",
            "sector performance and comparative analysis",
            "expert forecasts and risk assessment"
        ]
    },
    "health": {
        "label": "Health",
        "newsapi_q": "health OR medicine OR wellness OR pandemic OR disease",
        "angles": [
            "public health implications and response measures",
            "scientific research findings and clinical significance",
            "healthcare system preparedness and resource allocation",
            "patient perspective and access to treatment",
            "prevention strategies and awareness campaigns"
        ]
    },
    "science": {
        "label": "Science",
        "newsapi_q": "science OR space OR discovery OR research OR climate",
        "angles": [
            "scientific significance and research methodology",
            "practical applications and timeline to impact",
            "broader implications for the field",
            "expert analysis and peer perspective",
            "future research directions and funding"
        ]
    },
    "entertainment": {
        "label": "Entertainment",
        "newsapi_q": "entertainment OR celebrity OR music OR film OR sports",
        "angles": [
            "cultural significance and audience reception",
            "industry trends and commercial performance",
            "behind-the-scenes insights and production details",
            "critical reception and awards prospects",
            "broader cultural impact and social media reaction"
        ]
    }
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

def safe_fetch_json(url, headers=None, timeout=15):
    """Fetch JSON from URL — returns None on failure."""
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"  Fetch failed: {e}")
        return None

def extract_subject_words(topic):
    """Extract important subject words for image search."""
    text = topic.lower()
    stop_words = set([
        "the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "is",
        "are", "was", "were", "be", "been", "being", "have", "has", "had",
        "how", "what", "why", "when", "where", "who", "which", "that", "this",
        "it", "its", "with", "from", "by", "at", "as", "but", "not", "no",
        "can", "could", "will", "would", "should", "may", "might", "must",
        "do", "does", "did", "about", "into", "over", "after", "before",
        "between", "under", "through", "during", "without", "within",
        "all", "each", "every", "both", "few", "more", "most", "other",
        "some", "such", "than", "too", "very", "just", "also", "now",
        "new", "your", "you", "we", "they", "our", "their", "my"
    ])
    words = [w.strip(".,!?;:'\"()-") for w in text.split()]
    subjects = [w for w in words if w not in stop_words and len(w) > 2]
    return " ".join(subjects[:4]) if subjects else topic.split()[:2]


# ── Image Sources ─────────────────────────────────────────
IMAGE_KEYWORDS = {
    "world": ["world news", "global politics", "international", "diplomacy"],
    "technology": ["technology", "innovation", "digital", "computer"],
    "business": ["business", "corporate", "economy", "trade"],
    "finance": ["finance", "stock market", "investment", "banking"],
    "health": ["health", "medical", "wellness", "healthcare"],
    "science": ["science", "research", "laboratory", "discovery"],
    "entertainment": ["entertainment", "music", "celebrity", "film"]
}

def score_image_relevance(photo_data, topic, category_key):
    """Score image relevance to topic (0-100)."""
    score = 50
    topic_lower = topic.lower()
    topic_words = set(topic_lower.split())
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
    for word in topic_words:
        if len(word) > 3 and word in all_text:
            score += 15
    return min(score, 100)

def fetch_pexels_image(topic, category_key):
    """Fetch image from Pexels."""
    if not PEXELS_KEY:
        return None
    query = extract_subject_words(topic)
    url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(query)}&per_page=3&orientation=landscape"
    print(f"  [Pexels] Searching: {query}")
    data = safe_fetch_json(url, headers={"Authorization": PEXELS_KEY}, timeout=15)
    if not data or not data.get("photos"):
        return None
    best = max(data["photos"][:3], key=lambda p: score_image_relevance(p, topic, category_key))
    return {"url": best["src"]["large"], "credit": best["photographer"], "source": "Pexels"}

def fetch_pixabay_image(topic, category_key):
    """Fetch image from Pixabay."""
    if not PIXABAY_KEY:
        return None
    query = extract_subject_words(topic)
    url = f"https://pixabay.com/api/?key={PIXABAY_KEY}&q={urllib.parse.quote(query)}&image_type=photo&orientation=horizontal&per_page=3&safesearch=true"
    print(f"  [Pixabay] Searching: {query}")
    data = safe_fetch_json(url, timeout=15)
    if not data or not data.get("hits"):
        return None
    best = max(data["hits"][:3], key=lambda h: score_image_relevance(h, topic, category_key))
    img_url = best.get("largeImageURL") or best.get("webformatURL", "")
    if not img_url:
        return None
    return {"url": img_url, "credit": best.get("user", "Pixabay User"), "source": "Pixabay"}

def fetch_freepik_image(topic, category_key):
    """Fetch image from Freepik API."""
    if not FREPIK_KEY:
        return None
    query = extract_subject_words(topic)
    url = f"https://api.freepik.com/v1/resources?locale=en-US&phrase={urllib.parse.quote(query)}&image_type=photo&orientation=landscape&limit=3&order=relevance"
    print(f"  [Freepik] Searching: {query}")
    data = safe_fetch_json(url, headers={
        "Accept-Language": "en-US",
        "Accept": "application/json",
        "Authorization": f"Bearer {FREPIK_KEY}"
    }, timeout=15)
    if not data or not data.get("data"):
        return None
    best = max(data["data"][:3], key=lambda item: score_image_relevance(item, topic, category_key))
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
    return {"url": img_url, "credit": best.get("creator", {}).get("name", "Freepik"), "source": "Freepik"}

def fetch_best_image(topic, category_key, article_title=None):
    """Try all image sources, pick the best."""
    search_text = article_title or topic
    print(f"  Searching images for: {search_text}")
    candidates = []
    for fetcher in [fetch_pexels_image, fetch_pixabay_image, fetch_freepik_image]:
        result = fetcher(search_text, category_key)
        if result:
            candidates.append(result)
    if not candidates:
        print("  No images found from any source")
        return None
    winner = max(candidates, key=lambda x: x.get("score", 50))
    print(f"  Winner: {winner['source']} by {winner['credit']}")
    return winner


# ── NewsAPI: Get real trending headlines ──────────────────
def get_trending_headlines(category_key):
    """Fetch trending headlines from NewsAPI for news generation."""
    if not NEWS_API_KEY:
        return None
    cat_info = NEWS_CATEGORIES.get(category_key, {})
    query = cat_info.get("newsapi_q", category_key)
    from_date = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")
    url = (
        f"https://newsapi.org/v2/everything?"
        f"q={urllib.parse.quote(query)}"
        f"&language=en"
        f"&sortBy=publishedAt"
        f"&pageSize=15"
        f"&from={from_date}"
        f"&apiKey={NEWS_API_KEY}"
    )
    print(f"  [NewsAPI] Fetching: {query}")
    data = safe_fetch_json(url, timeout=15)
    if not data or data.get("status") != "ok" or not data.get("articles"):
        print(f"  [NewsAPI] No results: {data.get('message', 'unknown') if data else 'fetch failed'}")
        return None
    headlines = []
    for article in data["articles"][:15]:
        title = article.get("title", "").strip()
        if title and len(title) > 20 and "[Removed]" not in title:
            headlines.append({
                "title": title,
                "description": article.get("description", ""),
                "source": article.get("source", {}).get("name", ""),
                "url": article.get("url", "")
            })
    return headlines if headlines else None


# ── AI News Generation ────────────────────────────────────
def generate_news_article(headline, category_key, category_label):
    """Call AI to write a news dispatch based on a trending headline."""
    print(f"\n  Generating dispatch for: {headline['title'][:80]}...")

    angles = NEWS_CATEGORIES[category_key]["angles"]
    angle = random.choice(angles)

    system_prompt = f"""You are a senior news correspondent for MenshlyGlobal, a premium international news outlet. You write engaging, well-sourced news dispatches.

RULES:
- Write a news analysis/dispatch about the provided headline
- Angle: {angle}
- Category: {category_label}
- Target length: 400-600 words
- Use a compelling headline (max 12 words)
- Include a 1-2 sentence news summary/standfirst
- Structure with markdown ## subheadings
- Include specific details, data points, and expert perspectives
- Write in journalistic third-person style
- Reference the original news source context
- Include context, background, and forward-looking analysis
- Return ONLY valid JSON with these exact keys:
  "title": string (headline),
  "summary": string (1-2 sentence news summary),
  "content": string (full dispatch body in markdown)"""

    user_prompt = f"""Write a news dispatch based on this headline: "{headline['title']}"
Source: {headline['source']}
Context: {headline.get('description', 'No additional context available')}

Write a comprehensive news analysis that provides context, expert perspectives, and forward-looking implications for readers."""

    body = json.dumps({
        "model": ACTIVE_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": 2500,
        "temperature": 0.7
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
        print(f"  AI API error {e.code}: {error_body[:200]}")
        return None
    except urllib.error.URLError as e:
        print(f"  AI API connection error: {e.reason}")
        return None

    raw = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not raw:
        print("  AI returned empty response")
        return None

    # Parse JSON response
    article = None
    try:
        article = json.loads(raw)
        if not article.get("content") or len(article["content"].strip()) < 150:
            print(f"  WARNING: Content too short ({len(article.get('content', ''))} chars)")
            article = None
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code block
    if not article:
        json_match = re.search(r'```(?:json)?\s*({.*?})\s*```', raw, re.DOTALL)
        if json_match:
            try:
                article = json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

    # Last resort: treat raw text as content
    if not article:
        article = {
            "title": headline["title"],
            "summary": headline.get("description", raw[:200]),
            "content": raw.strip()
        }

    content_len = len(article.get("content", ""))
    if content_len < 150:
        print(f"  WARNING: Final content still too short ({content_len} chars)")
        return None

    print(f"  Title: {article.get('title', 'No title')}")
    print(f"  Content: {content_len} chars")
    return article


# ── Build Hugo Markdown ───────────────────────────────────
def build_news_markdown(article, category_key, category_label, image_data):
    """Convert news article to Hugo markdown for content/posts/."""
    now = datetime.now(timezone.utc) - timedelta(hours=1)
    date_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    timestamp = int(now.timestamp() * 1000)

    slug = slugify(article.get("title", f"news-{timestamp}"))
    # Add timestamp prefix to ensure uniqueness
    slug = f"{timestamp}-{slug}"

    author = random.choice(AUTHORS)
    title = article.get("title", "").strip().replace('"', "'")

    # Build tags
    words = title.lower().split()
    stop = {"the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "is", "are"}
    tags = [w for w in words if w not in stop and len(w) > 2][:4]
    tags.extend([category_label, "2026", "Breaking"])
    tags = list(set(tags))[:6]

    summary = article.get("summary", "")[:160].replace('"', "").replace("\n", " ")

    # Build front matter — NO leading whitespace!
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
        f'description: "{summary}"',
        "---",
        "",
    ])

    # Build body content — clean, no excessive whitespace
    body_lines = article.get("summary", "").strip()
    body_lines += "\n\n" + article.get("content", "").strip()

    full = "\n".join(fm_lines) + body_lines
    return full, slug


# ── Main ───────────────────────────────────────────────────
def main():
    os.makedirs("output", exist_ok=True)

    generated = []

    for i in range(NEWS_COUNT):
        print(f"\n{'='*60}")
        print(f"ARTICLE {i+1}/{NEWS_COUNT}")
        print(f"{'='*60}")

        # Pick category
        cat_keys = list(NEWS_CATEGORIES.keys())
        category_key = random.choice(cat_keys)
        cat_info = NEWS_CATEGORIES[category_key]
        category_label = cat_info["label"]

        # Get trending headlines from NewsAPI
        headlines = get_trending_headlines(category_key)
        if not headlines:
            print(f"  No headlines from NewsAPI for {category_label}, trying next category...")
            # Try all categories
            for alt_key in random.sample(cat_keys, min(3, len(cat_keys))):
                if alt_key != category_key:
                    headlines = get_trending_headlines(alt_key)
                    if headlines:
                        category_key = alt_key
                        cat_info = NEWS_CATEGORIES[category_key]
                        category_label = cat_info["label"]
                        break

        if not headlines:
            print("  WARNING: No headlines available from any category. Skipping.")
            continue

        # Pick a headline we haven't used
        used_titles = {g.get("headline", "") for g in generated}
        available = [h for h in headlines if h["title"] not in used_titles]
        if not available:
            available = headlines
        headline = random.choice(available)

        print(f"  Category: {category_label}")
        print(f"  Headline: {headline['title'][:80]}...")

        # Generate article
        article = generate_news_article(headline, category_key, category_label)
        if not article:
            print("  FAILED to generate article. Skipping.")
            continue

        article_title = article.get("title", headline["title"])

        # Fetch image
        image_data = fetch_best_image(headline["title"], category_key, article_title)

        # Build markdown
        markdown, slug = build_news_markdown(article, category_key, category_label, image_data)

        # Check for duplicate
        post_path = f"content/posts/{slug}.md"
        if os.path.exists(post_path):
            print(f"  Article '{slug}' already exists — skipping.")
            continue

        # Save
        output_path = f"output/news-{i}.md"
        with open(output_path, "w") as f:
            f.write(markdown)

        generated.append({
            "file": output_path,
            "slug": slug,
            "title": article_title,
            "headline": headline["title"],
            "category": category_label
        })
        print(f"\n  SAVED: {output_path}")

    # Write manifest
    with open("output/manifest.json", "w") as f:
        json.dump(generated, f, indent=2)

    print(f"\n{'='*60}")
    print(f"GENERATED {len(generated)}/{NEWS_COUNT} ARTICLES")
    print(f"{'='*60}")
    for g in generated:
        print(f"  - [{g['category']}] {g['title']}")

    if not generated:
        print("\nNo articles generated this run.")
        open("output/error.log", "w").write("No articles generated from any source.\n")


if __name__ == "__main__":
    main()
