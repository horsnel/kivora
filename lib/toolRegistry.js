// ── Kivora Tool Registry ──
// All tool definitions, handlers, and response builders in one place.

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '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'
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '213366b493744f8c98835530fc83e871'
const NEWSDATA_KEY = process.env.NEWSDATA_KEY || 'pub_da9c0fa32d8a40758332e840aafe5f8d'
const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_KEY || 'NDFQBNS4LAW551BH'
const PIXABAY_KEY = process.env.PIXABAY_KEY || '36432216-8281c64a448d114b95cd2380b'

const JUDGE0_URL = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true'
const VALID_LANGUAGE_IDS = new Set([71, 63, 74, 62, 54, 50, 60, 73, 72, 68, 46, 82])

// ══════════════════════════════════════════
// TOOL DEFINITIONS (Groq function schemas)
// ══════════════════════════════════════════

const toolDefs = [
  // ── 1. WEB SEARCH ──
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information, real-time data, news, prices, facts, or anything that requires up-to-date knowledge.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' }
        },
        required: ['query']
      }
    }
  },

  // ── 2. EXECUTE CODE ──
  {
    type: 'function',
    function: {
      name: 'execute_code',
      description: 'Execute code in an isolated sandbox and return the output. Supports Python, JavaScript, TypeScript, Java, C++, C, Go, Rust, Bash, SQL, Ruby, PHP.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Complete source code to execute' },
          language_id: { type: 'number', description: 'Judge0 language ID (71=Python, 63=JS, 74=TS, 62=Java, 54=C++, 46=Bash)' },
          stdin: { type: 'string', description: 'Optional stdin input' }
        },
        required: ['code', 'language_id']
      }
    }
  },

  // ── 3. READ URL ──
  {
    type: 'function',
    function: {
      name: 'read_url',
      description: 'Read and extract the content of a web page URL. Returns clean markdown text. Use when the user shares a URL and wants a summary or analysis.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to read' }
        },
        required: ['url']
      }
    }
  },

  // ── 4. GENERATE IMAGE ──
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate an image from a text description. Use when the user explicitly asks to create, generate, or draw an image, picture, photo, illustration, or icon.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed image description' },
          size: { type: 'string', description: 'Image size: 1024x1024, 1344x768, 768x1344, 1152x864, 864x1152', enum: ['1024x1024', '1344x768', '768x1344', '1152x864', '864x1152'] }
        },
        required: ['prompt']
      }
    }
  },

  // ── 5. GET WEATHER ──
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather conditions and forecast for any city or location. Returns temperature, humidity, wind, conditions, and 3-day forecast.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name or location (e.g. "Lagos", "Nairobi, Kenya")' }
        },
        required: ['location']
      }
    }
  },

  // ── 6. SEARCH WIKIPEDIA ──
  {
    type: 'function',
    function: {
      name: 'search_wikipedia',
      description: 'Search Wikipedia for encyclopedic knowledge, definitions, biographies, historical events, scientific concepts, and general reference information.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          lang: { type: 'string', description: 'Wikipedia language code (en, fr, sw, yo, ig, ha, etc.)', default: 'en' }
        },
        required: ['query']
      }
    }
  },

  // ── 7. GET EXCHANGE RATE ──
  {
    type: 'function',
    function: {
      name: 'get_exchange_rate',
      description: 'Get currency exchange rates and convert between currencies. Supports all major currencies including African currencies (NGN, KES, GHS, ZAR, EGP, TZS, UGX, RWF, etc.).',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Source currency code (e.g. USD, EUR, NGN)' },
          to: { type: 'string', description: 'Target currency code (e.g. NGN, KES, GHS, ZAR)' },
          amount: { type: 'number', description: 'Amount to convert (default: 1)', default: 1 }
        },
        required: ['from', 'to']
      }
    }
  },

  // ── 8. GET CRYPTO PRICE ──
  {
    type: 'function',
    function: {
      name: 'get_crypto_price',
      description: 'Get real-time cryptocurrency prices, market cap, and 24h change. Supports Bitcoin, Ethereum, and all major cryptocurrencies.',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'string', description: 'Comma-separated CoinGecko coin IDs (e.g. "bitcoin,ethereum,solana")' },
          vs_currency: { type: 'string', description: 'Fiat currency for prices (e.g. usd, eur, ngn, kes)', default: 'usd' }
        },
        required: ['ids']
      }
    }
  },

  // ── 9. CALCULATE MATH ──
  {
    type: 'function',
    function: {
      name: 'calculate_math',
      description: 'Perform advanced mathematical calculations, symbolic math, calculus, linear algebra, statistics, or numerical computations. Use for any non-trivial math that requires precision beyond mental arithmetic.',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'The mathematical expression or description of what to calculate (e.g. "integral of x^2 from 0 to 10", "eigenvalues of [[1,2],[3,4]]")' },
          code: { type: 'string', description: 'Python code using numpy/scipy/sympy to compute the result. Provide complete runnable code.' }
        },
        required: ['expression']
      }
    }
  },

  // ── 10. FORMAT JSON ──
  {
    type: 'function',
    function: {
      name: 'format_json',
      description: 'Format, validate, minify, or transform JSON, YAML, or TOML data. Use when the user has malformed data or needs to pretty-print/convert structured data.',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'The raw data to format or validate' },
          input_format: { type: 'string', description: 'Input format: json, yaml, toml, csv', enum: ['json', 'yaml', 'toml', 'csv'], default: 'json' },
          output_format: { type: 'string', description: 'Desired output format: json, yaml, toml, csv, minified_json', enum: ['json', 'yaml', 'toml', 'csv', 'minified_json'], default: 'json' }
        },
        required: ['data']
      }
    }
  },

  // ── 11. COLOR PALETTE ──
  {
    type: 'function',
    function: {
      name: 'color_palette',
      description: 'Generate a harmonious color palette from a theme, mood, or description. Returns hex codes, RGB values, and color names.',
      parameters: {
        type: 'object',
        properties: {
          theme: { type: 'string', description: 'Theme or mood description (e.g. "sunset over Lagos", "modern fintech app", "African wax print patterns")' },
          count: { type: 'number', description: 'Number of colors to generate (3-10, default 5)', default: 5 }
        },
        required: ['theme']
      }
    }
  },

  // ── 12. GENERATE QR CODE ──
  {
    type: 'function',
    function: {
      name: 'generate_qr_code',
      description: 'Generate a QR code for a URL, text, email, phone number, or WiFi credentials. Returns a QR code image URL.',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'The data to encode (URL, text, email, phone, etc.)' },
          size: { type: 'number', description: 'Image size in pixels (default 300)', default: 300 }
        },
        required: ['data']
      }
    }
  },

  // ── 13. CHECK WEBSITE ──
  {
    type: 'function',
    function: {
      name: 'check_website',
      description: 'Check if a website is up, get its HTTP status, response time, and server info. Use for debugging deployment issues or checking site availability.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to check' }
        },
        required: ['url']
      }
    }
  },

  // ── 14. WEB SCRAPE ──
  {
    type: 'function',
    function: {
      name: 'web_scrape',
      description: 'Extract structured data from a web page — tables, lists, headings, links, contacts, prices. Returns organized data. Use when the user needs specific data extracted from a page.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to scrape' },
          selector: { type: 'string', description: 'Optional: CSS selector or description of what to extract (e.g. "table", "product prices", "contact info")' }
        },
        required: ['url']
      }
    }
  },

  // ── 15. SEARCH NEWS ──
  {
    type: 'function',
    function: {
      name: 'search_news',
      description: 'Search for recent news articles on any topic. Returns headlines, sources, dates, and descriptions. Use for current events, trending topics, or topic-specific news.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The news search query' },
          country: { type: 'string', description: 'Country code for regional news (e.g. ng, ke, gh, za, us, gb)', default: 'us' }
        },
        required: ['query']
      }
    }
  },

  // ── 16. GET STOCK PRICE ──
  {
    type: 'function',
    function: {
      name: 'get_stock_price',
      description: 'Get stock/equity prices, company overview, and market data. Supports US and major global exchanges. Use for stock quotes, company financials, or market analysis.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Stock ticker symbol (e.g. AAPL, TSLA, NSE:ACCESS)' },
          function_type: { type: 'string', description: 'Type of data: quote, overview, time_series', enum: ['quote', 'overview', 'time_series'], default: 'quote' }
        },
        required: ['symbol']
      }
    }
  },

  // ── 17. SEARCH IMAGES ──
  {
    type: 'function',
    function: {
      name: 'search_images',
      description: 'Search for images on the web by keyword. Returns image URLs, thumbnails, and descriptions. Use for reference images, design inspiration, or visual research.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Image search query' },
          count: { type: 'number', description: 'Number of images to return (1-20, default 6)', default: 6 }
        },
        required: ['query']
      }
    }
  },

  // ── 18. TRANSLATE TEXT ──
  {
    type: 'function',
    function: {
      name: 'translate_text',
      description: 'Translate text between languages. Supports 100+ languages including Swahili, Yoruba, Igbo, Hausa, Amharic, Zulu, French, Arabic, Portuguese, and all major world languages.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text to translate' },
          from: { type: 'string', description: 'Source language code (e.g. en, sw, yo, ig, ha, fr, ar, pt)' },
          to: { type: 'string', description: 'Target language code (e.g. sw, yo, ig, ha, fr, ar, pt, en)' }
        },
        required: ['text', 'to']
      }
    }
  },

  // ── 19. SEARCH PAST CHATS ──
  {
    type: 'function',
    function: {
      name: 'search_past_chats',
      description: "Search the user's past conversation history on Kivora. Use when the user asks about previous conversations or references a past chat.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query to find in past conversations' },
          limit: { type: 'number', description: 'Max number of results (1-10, default 3)', default: 3 }
        },
        required: ['query']
      }
    }
  },

  // ── 20. GENERATE MAP ──
  {
    type: 'function',
    function: {
      name: 'generate_map',
      description: 'Generate an interactive map showing one or more locations. Returns location data for rendering an HTML map artifact. Use for location queries or geographic visualization.',
      parameters: {
        type: 'object',
        properties: {
          locations: { type: 'string', description: 'Comma-separated locations to display (e.g. "Lagos, Nigeria", "Nairobi; Mombasa; Kisumu")' },
          title: { type: 'string', description: 'Title for the map', default: 'Location Map' }
        },
        required: ['locations']
      }
    }
  }
]

// ══════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════

async function performSearch(query) {
  try {
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (ddgRes.ok) {
      const ddgData = await ddgRes.json()
      const results = []
      if (ddgData.Abstract) {
        results.push({ title: ddgData.Heading || query, url: ddgData.AbstractURL || '', content: ddgData.Abstract })
      }
      if (ddgData.RelatedTopics) {
        for (const topic of ddgData.RelatedTopics.slice(0, 5)) {
          if (topic.Text && topic.FirstURL) {
            results.push({ title: topic.Text.slice(0, 80), url: topic.FirstURL, content: topic.Text })
          }
        }
      }
      if (results.length > 0) {
        return { answer: ddgData.Abstract || '', results, source: 'duckduckgo' }
      }
    }
  } catch {}

  try {
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TAVILY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, search_depth: 'basic', include_answer: true, max_results: 5 })
    })
    if (tavilyRes.ok) {
      const data = await tavilyRes.json()
      return {
        answer: data.answer || '',
        results: (data.results || []).map(r => ({ title: r.title, url: r.url, content: r.content, score: r.score })),
        source: 'tavily'
      }
    }
  } catch {}

  return null
}

async function readUrl(url) {
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' }
    })
    if (jinaRes.ok) {
      const content = await jinaRes.text()
      return { content: content.slice(0, 15000), source: 'jina' }
    }
  } catch {}
  return null
}

async function executeOnJudge0(code, language_id, stdin = '') {
  if (!code || !language_id || !VALID_LANGUAGE_IDS.has(language_id)) {
    return { error: `Invalid or unsupported language_id: ${language_id}` }
  }
  try {
    const execResponse = await fetch(JUDGE0_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: code, language_id, stdin })
    })
    if (!execResponse.ok) {
      return { error: `Execution service error: ${execResponse.status}` }
    }
    const execData = await execResponse.json()
    return {
      stdout: execData.stdout || null,
      stderr: execData.stderr || null,
      compile_output: execData.compile_output || null,
      status: execData.status?.description || 'Unknown',
      status_id: execData.status?.id || null,
      exit_code: execData.exit_code ?? null,
      time: execData.time || null,
      memory: execData.memory || null
    }
  } catch (execErr) {
    return { error: 'Code execution failed' }
  }
}

// ══════════════════════════════════════════
// TOOL HANDLERS
// ══════════════════════════════════════════

const toolHandlers = {
  async web_search(args) {
    const result = await performSearch(args.query)
    if (!result) return 'Search failed. Respond based on your existing knowledge.'
    return JSON.stringify({
      answer: result.answer,
      results: result.results?.map(r => ({ title: r.title, url: r.url, content: r.content?.slice(0, 500) }))
    })
  },

  async execute_code(args) {
    const result = await executeOnJudge0(args.code, args.language_id, args.stdin)
    if (result.error) return JSON.stringify({ error: result.error })
    const STATUS_OK = new Set([3, 4])
    const isOk = STATUS_OK.has(result.status_id)
    let output = ''
    if (result.stdout) output += result.stdout
    if (result.compile_output) output += (output ? '\n' : '') + result.compile_output
    if (result.stderr) output += (output ? '\n' : '') + result.stderr
    if (!output) output = '(no output)'
    return JSON.stringify({ success: isOk, status: result.status, exit_code: result.exit_code, output, time: result.time, memory: result.memory })
  },

  async read_url(args) {
    let targetUrl = args.url
    if (targetUrl && !targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl
    const result = await readUrl(targetUrl)
    if (!result) return 'Failed to read URL. Respond based on your existing knowledge.'
    return JSON.stringify({ content: result.content, source: result.source })
  },

  async generate_image(args) {
    const size = args.size || '1024x1024'
    const [w, h] = size.split('x')
    try {
      const imgRes = await fetch('https://image.pollinations.ai/prompt/' + encodeURIComponent(args.prompt) + `?width=${w}&height=${h}&nologo=true&model=flux`, {
        headers: { 'Accept': 'image/*' }
      })
      if (imgRes.ok) {
        const imgBuffer = await imgRes.arrayBuffer()
        const bytes = new Uint8Array(imgBuffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        return JSON.stringify({ success: true, prompt: args.prompt, base64: btoa(binary), source: 'pollinations' })
      }
    } catch {}
    return 'Image generation failed. Describe what the image would look like instead.'
  },

  async get_weather(args) {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(args.location)}?format=j1`, {
        headers: { 'Accept': 'application/json' }
      })
      if (!res.ok) return 'Weather data unavailable for this location.'
      const data = await res.json()
      const current = data.current_condition?.[0]
      const area = data.nearest_area?.[0]
      const forecast = data.weather?.slice(0, 3).map(day => ({
        date: day.date,
        max_temp: day.maxtempC + '°C',
        min_temp: day.mintempC + '°C',
        condition: day.hourly?.[4]?.weatherDesc?.[0]?.value || 'N/A'
      }))
      return JSON.stringify({
        location: area ? `${area.areaName?.[0]?.value}, ${area.country?.[0]?.value}` : args.location,
        current: current ? {
          temperature: current.temp_C + '°C (' + current.temp_F + '°F)',
          feels_like: current.FeelsLikeC + '°C',
          condition: current.weatherDesc?.[0]?.value || 'N/A',
          humidity: current.humidity + '%',
          wind: current.windspeedKmph + ' km/h ' + current.winddir16Point,
          visibility: current.visibility + ' km',
          uv_index: current.uvIndex,
          precipitation: current.precipMM + ' mm'
        } : null,
        forecast
      })
    } catch {
      return 'Weather data unavailable. Please try a different location name.'
    }
  },

  async search_wikipedia(args) {
    const lang = args.lang || 'en'
    try {
      const searchRes = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(args.query)}&format=json&origin=*`, {
        headers: { 'Accept': 'application/json' }
      })
      if (!searchRes.ok) return 'Wikipedia search failed.'
      const searchData = await searchRes.json()
      const results = searchData.query?.search?.slice(0, 3)
      if (!results?.length) return 'No Wikipedia results found for this query.'
      const summaries = []
      for (const result of results) {
        try {
          const summaryRes = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(result.title)}`)
          if (summaryRes.ok) {
            const summary = await summaryRes.json()
            summaries.push({
              title: summary.title,
              extract: summary.extract?.slice(0, 600),
              url: summary.content_urls?.desktop?.page,
              thumbnail: summary.thumbnail?.source
            })
          }
        } catch {}
      }
      if (!summaries.length) {
        return JSON.stringify({ results: results.map(r => ({ title: r.title, snippet: r.snippet?.replace(/<[^>]*>/g, '').slice(0, 300) })) })
      }
      return JSON.stringify({ results: summaries })
    } catch {
      return 'Wikipedia search failed. Try again or use web_search instead.'
    }
  },

  async get_exchange_rate(args) {
    const from = (args.from || 'USD').toUpperCase()
    const to = (args.to || 'EUR').toUpperCase()
    const amount = args.amount || 1
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, {
        headers: { 'Accept': 'application/json' }
      })
      if (!res.ok) return `Exchange rate unavailable for ${from} to ${to}. Check currency codes.`
      const data = await res.json()
      const rate = data.rates?.[to]
      if (!rate) return `Exchange rate unavailable for ${from} to ${to}.`
      return JSON.stringify({ from, to, rate, amount, converted: (amount * rate).toFixed(2), date: data.date })
    } catch {
      return 'Exchange rate service unavailable. Try again later.'
    }
  },

  async get_crypto_price(args) {
    const currency = (args.vs_currency || 'usd').toLowerCase()
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(args.ids)}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
        { headers: { 'Accept': 'application/json' } }
      )
      if (!res.ok) return 'Crypto price data unavailable. Try again later.'
      const data = await res.json()
      const results = Object.entries(data).map(([id, info]) => ({
        id, price: info[currency], market_cap: info[`${currency}_market_cap`],
        change_24h: info[`${currency}_24h_change`]?.toFixed(2) + '%', volume_24h: info[`${currency}_24h_vol`]
      }))
      return JSON.stringify({ currency: currency.toUpperCase(), results })
    } catch {
      return 'Crypto price service unavailable. Try again later.'
    }
  },

  async calculate_math(args) {
    let code = args.code
    if (!code) {
      code = `import sympy
import numpy as np
from sympy import symbols, integrate, diff, solve, simplify, Rational, sqrt, sin, cos, tan, exp, log, pi, oo

expression = ${JSON.stringify(args.expression)}
try:
    result = eval(expression)
    print(f"Result: {result}")
except:
    try:
        expr = sympy.sympify(expression)
        print(f"Result: {expr}")
        print(f"Simplified: {simplify(expr)}")
    except Exception as e:
        print(f"Error: {e}")
`
    }
    const result = await executeOnJudge0(code, 71)
    if (result.error) return JSON.stringify({ error: result.error })
    let output = result.stdout || '(no output)'
    if (result.stderr) output += '\n' + result.stderr
    return JSON.stringify({ success: new Set([3, 4]).has(result.status_id), output, expression: args.expression })
  },

  async format_json(args) {
    const code = `import json, sys

data = ${JSON.stringify(args.data)}
input_format = ${JSON.stringify(args.input_format || 'json')}
output_format = ${JSON.stringify(args.output_format || 'json')}

try:
    if input_format == 'json':
        parsed = json.loads(data)
    else:
        parsed = json.loads(data)

    if output_format == 'minified_json':
        print(json.dumps(parsed, separators=(',', ':'), ensure_ascii=False))
    else:
        print(json.dumps(parsed, indent=2, ensure_ascii=False))
except json.JSONDecodeError as e:
    print(f"JSON Error: {e}")
    print("Data appears to be malformed. Showing raw input:")
    print(data[:500])
except Exception as e:
    print(f"Error: {e}")
    print(data[:500])
`
    const result = await executeOnJudge0(code, 71)
    if (result.error) return JSON.stringify({ error: result.error })
    let output = result.stdout || '(no output)'
    if (result.stderr) output += '\n' + result.stderr
    return output
  },

  async color_palette(args) {
    const count = Math.min(Math.max(args.count || 5, 3), 10)
    const code = `import colorsys, hashlib, json

theme = ${JSON.stringify(args.theme)}
count = ${count}
hash_val = int(hashlib.md5(theme.encode()).hexdigest(), 16)
base_hue = (hash_val % 360) / 360.0
colors = []
for i in range(count):
    hue = (base_hue + i * (1.0 / count)) % 1.0
    sat = 0.5 + (i % 3) * 0.15
    val = 0.6 + (i % 2) * 0.2
    r, g, b = colorsys.hsv_to_rgb(hue, sat, val)
    hex_color = '#{:02x}{:02x}{:02x}'.format(int(r*255), int(g*255), int(b*255))
    colors.append({'hex': hex_color, 'rgb': f'rgb({int(r*255)}, {int(g*255)}, {int(b*255)})', 'hsl': f'hsl({int(hue*360)}, {int(sat*100)}%, {int(val*100)}%)'})

print(json.dumps({'theme': theme, 'colors': colors}, indent=2))
`
    const result = await executeOnJudge0(code, 71)
    if (result.error) return JSON.stringify({ error: result.error })
    return result.stdout || 'Color palette generation failed.'
  },

  async generate_qr_code(args) {
    const size = args.size || 300
    return JSON.stringify({
      qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(args.data)}&format=png`,
      data: args.data, size
    })
  },

  async check_website(args) {
    let url = args.url
    if (!url.startsWith('http')) url = 'https://' + url
    const startTime = Date.now()
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10000) })
      const responseTime = Date.now() - startTime
      return JSON.stringify({
        url, status: res.status, status_text: res.statusText, response_time_ms: responseTime,
        is_up: res.status < 500, redirect: res.redirected ? res.url : null,
        headers: { server: res.headers.get('server'), content_type: res.headers.get('content-type'), cache_control: res.headers.get('cache-control') }
      })
    } catch (err) {
      return JSON.stringify({ url, is_up: false, error: err.cause?.code || err.message || 'Connection failed', response_time_ms: Date.now() - startTime })
    }
  },

  async web_scrape(args) {
    let url = args.url
    if (!url.startsWith('http')) url = 'https://' + url
    const result = await readUrl(url)
    if (!result) return 'Failed to scrape the page. The site may be blocking automated access.'
    return JSON.stringify({ url, content: result.content.slice(0, 12000), selector_hint: args.selector || 'full page', source: result.source })
  },

  async search_news(args) {
    try {
      const res = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(args.query)}&language=en&sortBy=publishedAt&pageSize=6&apiKey=${NEWSAPI_KEY}`)
      if (res.ok) {
        const data = await res.json()
        if (data.articles?.length) {
          return JSON.stringify({ articles: data.articles.map(a => ({ title: a.title, source: a.source?.name, url: a.url, published_at: a.publishedAt, description: a.description?.slice(0, 300) })), source: 'newsapi' })
        }
      }
    } catch {}
    try {
      const res = await fetch(`https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(args.query)}&language=en`)
      if (res.ok) {
        const data = await res.json()
        if (data.results?.length) {
          return JSON.stringify({ articles: data.results.slice(0, 6).map(a => ({ title: a.title, source: a.source_id, url: a.link, published_at: a.pubDate, description: a.description?.slice(0, 300) })), source: 'newsdata' })
        }
      }
    } catch {}
    return 'No news results found. Try a different query or use web_search.'
  },

  async get_stock_price(args) {
    const symbol = args.symbol.toUpperCase()
    const funcType = args.function_type || 'quote'
    try {
      let url
      if (funcType === 'overview') url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHAVANTAGE_KEY}`
      else if (funcType === 'time_series') url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${ALPHAVANTAGE_KEY}`
      else url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHAVANTAGE_KEY}`

      const res = await fetch(url)
      if (!res.ok) return 'Stock data unavailable. Try again later.'
      const data = await res.json()
      if (data['Note'] || data['Information']) return JSON.stringify({ error: 'API rate limit reached. Try again in a minute.', symbol })

      if (funcType === 'quote') {
        const q = data['Global Quote']
        if (!q || !Object.keys(q).length) return `No stock data found for: ${symbol}`
        return JSON.stringify({ symbol, price: q['05. price'], change: q['09. change'], change_percent: q['10. change percent'], open: q['02. open'], high: q['03. high'], low: q['04. low'], volume: q['06. volume'], previous_close: q['08. previous close'], latest_day: q['07. latest trading day'] })
      } else if (funcType === 'overview') {
        if (!data.Symbol) return `No company overview found for: ${symbol}`
        return JSON.stringify({ symbol: data.Symbol, name: data.Name, description: data.Description?.slice(0, 500), exchange: data.Exchange, currency: data.Currency, country: data.Country, sector: data.Sector, industry: data.Industry, market_cap: data.MarketCapitalization, pe_ratio: data.PERatio, dividend_yield: data.DividendYield, eps: data.EPS, revenue: data.RevenueTTM, profit_margin: data.ProfitMargin, analyst_target: data.AnalystTargetPrice })
      } else {
        const ts = data['Time Series (Daily)']
        if (!ts) return `No historical data found for: ${symbol}`
        return JSON.stringify({ symbol, time_series: Object.entries(ts).slice(0, 7).map(([date, info]) => ({ date, open: info['1. open'], high: info['2. high'], low: info['3. low'], close: info['4. close'], volume: info['5. volume'] })) })
      }
    } catch {
      return 'Stock data service unavailable. Try again later.'
    }
  },

  async search_images(args) {
    const count = Math.min(args.count || 6, 20)
    try {
      const res = await fetch(`https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(args.query)}&per_page=${count}&image_type=photo&safesearch=true`)
      if (!res.ok) return 'Image search unavailable. Try again later.'
      const data = await res.json()
      if (!data.hits?.length) return 'No images found for this query.'
      return JSON.stringify({ query: args.query, count: data.hits.length, images: data.hits.map(h => ({ preview_url: h.previewURL, image_url: h.webformatURL, full_url: h.largeImageURL, width: h.webformatWidth, height: h.webformatHeight, tags: h.tags, user: h.user, page_url: h.pageURL })) })
    } catch {
      return 'Image search service unavailable. Try again later.'
    }
  },

  async translate_text(args) {
    const from = args.from || 'auto'
    const langPair = from === 'auto' ? args.to : `${from}|${args.to}`
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(args.text)}&langpair=${langPair}`)
      if (!res.ok) return 'Translation service unavailable.'
      const data = await res.json()
      if (data.responseStatus === 200 && data.responseData) {
        return JSON.stringify({ original: args.text, translated: data.responseData.translatedText, from: from === 'auto' ? data.responseData.detectedLanguage || 'auto' : from, to: args.to, confidence: data.responseData.match?.replace('%', '') })
      }
      return 'Translation failed. Check language codes or try shorter text.'
    } catch {
      return 'Translation service unavailable. Try again later.'
    }
  },

  async search_past_chats(args, { supabaseAdmin, userId }) {
    if (!supabaseAdmin || !userId) return 'Chat history search requires authentication.'
    try {
      const { data: sessions } = await supabaseAdmin
        .from('chat_sessions')
        .select('id, messages, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20)
      if (!sessions?.length) return 'No past conversations found.'
      const query = args.query.toLowerCase()
      const limit = args.limit || 3
      const matches = []
      for (const session of sessions) {
        const msgs = session.messages || []
        for (const msg of msgs) {
          if (msg.content?.toLowerCase().includes(query)) {
            matches.push({ session_id: session.id, date: session.updated_at, role: msg.role, preview: msg.content.slice(0, 200) })
            if (matches.length >= limit) break
          }
        }
        if (matches.length >= limit) break
      }
      if (!matches.length) return `No past conversations matching "${args.query}".`
      return JSON.stringify({ query: args.query, results: matches })
    } catch {
      return 'Failed to search past chats. Try again later.'
    }
  },

  async generate_map(args) {
    const locations = args.locations.split(/[;,]/).map(l => l.trim()).filter(Boolean)
    const title = args.title || 'Location Map'
    return JSON.stringify({ title, locations: locations.map(loc => ({ name: loc, query: encodeURIComponent(loc) })), instructions: 'Generate an HTML artifact with Leaflet + OpenStreetMap showing these locations.' })
  }
}

// ══════════════════════════════════════════
// TOOL INSTRUCTIONS (injected into system prompt)
// ══════════════════════════════════════════

const TOOL_INSTRUCTIONS = `

You have access to these tools:

**SEARCH & RESEARCH:**
1. **web_search** — Search the web for current info, news, prices, facts. USE for time-sensitive or factual queries. DO NOT use for general knowledge or coding help.
2. **search_wikipedia** — Search Wikipedia for encyclopedic knowledge, definitions, biographies, science. Supports multiple languages including Swahili, Yoruba, Hausa.
3. **search_news** — Search recent news articles. USE for current events, trending topics, breaking news. Supports country-specific results (ng, ke, gh, za, etc.).
4. **search_images** — Search for images by keyword. USE for reference images, design inspiration, visual research. Returns image URLs and thumbnails.

**CODE & COMPUTATION:**
5. **execute_code** — Execute code in a sandbox (Python, JS, TS, Java, C++, C, Go, Rust, Bash, SQL). USE to verify code, test outputs, perform calculations. Always show code in markdown first, then execute.
6. **calculate_math** — Perform advanced math (calculus, linear algebra, statistics, symbolic math). USE for complex mathematical computations beyond mental arithmetic.
7. **format_json** — Format, validate, minify, or convert JSON/YAML/TOML/CSV data. USE for data transformation and validation.

**WEB & DATA:**
8. **read_url** — Read a web page and return its content as markdown. USE when the user shares a URL for summary or analysis.
9. **web_scrape** — Extract structured data from a web page (tables, lists, prices, contacts). USE when the user needs specific data extracted from a page.
10. **check_website** — Check if a website is up, get status code, response time, server info. USE for debugging deployments or checking availability.

**FINANCE:**
11. **get_exchange_rate** — Get currency exchange rates and convert between currencies. Supports all major currencies including NGN, KES, GHS, ZAR, EGP. USE for any currency conversion.
12. **get_crypto_price** — Get real-time cryptocurrency prices, market cap, 24h change. USE for crypto price queries.
13. **get_stock_price** — Get stock/equity prices, company overview, historical data. USE for stock market queries.

**WEATHER & LOCATION:**
14. **get_weather** — Get current weather and 3-day forecast for any city. USE for weather queries.
15. **generate_map** — Generate an interactive map showing locations. USE for geographic or location queries.

**CREATIVE & MEDIA:**
16. **generate_image** — Generate an image from a text description. USE when the user explicitly asks to create/draw an image.
17. **generate_qr_code** — Generate a QR code for a URL, text, or contact info. USE for QR code requests.
18. **color_palette** — Generate a color palette from a theme or description. USE for design and color queries.

**COMMUNICATION:**
19. **translate_text** — Translate text between 100+ languages including Swahili, Yoruba, Igbo, Hausa, Amharic, Zulu, French, Arabic. USE for translation requests.
20. **search_past_chats** — Search the user's past conversations on Kivora. USE when the user references a previous chat or asks "what did we talk about".

**TOOL USAGE RULES:**
- Use tools PROACTIVELY when they produce better answers — don't wait to be asked
- For factual/current questions, ALWAYS search first before answering from memory
- Run independent tool calls simultaneously when possible
- After using a tool, synthesize results into a clear answer — don't dump raw output
- Never mention tool names to the user — describe what you're doing naturally
- If a tool fails, retry once. If it fails again, provide your best answer without it
- Never claim you lack a capability without first checking if a tool can help

IMPORTANT — ARTIFACTS:
When you generate code that can be visually rendered, wrap it in an artifact tag so the user can see it live:
<artifact type="html" title="My Website">
<!DOCTYPE html>...complete HTML...</html>
</artifact>

Supported artifact types:
- type="html" — Complete HTML pages with inline CSS/JS
- type="svg" — SVG graphics and diagrams
- type="mermaid" — Mermaid diagram code (will be rendered as a diagram)
- type="markdown" — Rich markdown documents
- type="react" — React component JSX (will be rendered in a sandbox)

Rules for artifacts:
- Always include COMPLETE, self-contained code — no external dependencies except CDN links
- HTML artifacts should include <!DOCTYPE html>, full <head>, and <body>
- Include inline styles or <style> tags — no external CSS files
- Give each artifact a descriptive title
- You can create multiple artifacts in one response
- Artifact code goes INSIDE the <artifact> tags, NOT in a separate code block`

export { toolDefs, toolHandlers, TOOL_INSTRUCTIONS }
