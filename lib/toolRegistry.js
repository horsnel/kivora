// ── Kivora Tool Registry ──
// All tool definitions, handlers, and response builders in one place.
// Sandbox providers: Daytona (primary) → Cloudflare Sandbox → Judge0 (fallback)

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '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'
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || ''
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || 'fc-9afd24762f1348c68c0c05e88130e890'
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '213366b493744f8c98835530fc83e871'
const NEWSDATA_KEY = process.env.NEWSDATA_KEY || 'pub_da9c0fa32d8a40758332e840aafe5f8d'
const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_KEY || 'NDFQBNS4LAW551BH'
const PIXABAY_KEY = process.env.PIXABAY_KEY || '36432216-8281c64a448d114b95cd2380b'

const JUDGE0_URL = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true'
const VALID_LANGUAGE_IDS = new Set([71, 63, 74, 62, 54, 50, 60, 73, 72, 68, 46, 82])

// ── Sandbox Configuration ──
const SANDBOX_URL = (process.env.KIVORA_SANDBOX_URL || '').replace(/\/$/, '')
const SANDBOX_API_KEY = process.env.KIVORA_SANDBOX_KEY || ''
const SANDBOX_AVAILABLE = !!SANDBOX_URL

// ── Daytona Sandbox Configuration (primary provider) ──
const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY || ''
const DAYTONA_AVAILABLE = !!DAYTONA_API_KEY

// ── Docker Sandbox Configuration (self-hosted fallback) ──
const DOCKER_HOST_URL = (process.env.DOCKER_HOST_URL || '').replace(/\/$/, '')
const DOCKER_AVAILABLE = !!DOCKER_HOST_URL

// Map Judge0 language IDs to sandbox commands
const LANG_TO_SANDBOX = {
  71: 'python3',   // Python 3
  63: 'node',      // JavaScript (Node.js)
  74: 'npx tsx',   // TypeScript
  62: 'java',      // Java
  54: 'g++',       // C++
  50: 'gcc',       // C
  60: 'go',        // Go
  73: 'rustc',     // Rust
  72: 'ruby',      // Ruby
  68: 'php',       // PHP
  46: 'bash',      // Bash
  82: 'sqlite3',   // SQL
}

function getSandboxHeaders() {
  const h = { 'Content-Type': 'application/json' }
  if (SANDBOX_API_KEY) h['Authorization'] = `Bearer ${SANDBOX_API_KEY}`
  return h
}

// Try sandbox first, fall back to Judge0
async function sandboxExec(sandboxId, command, timeout = 30000) {
  const url = `${SANDBOX_URL}/exec?sandbox_id=${encodeURIComponent(sandboxId)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: getSandboxHeaders(),
    body: JSON.stringify({ command, timeout, cwd: '/workspace' }),
  })
  if (!res.ok) throw new Error(`Sandbox error: ${res.status}`)
  return res.json()
}

async function sandboxRunCode(sandboxId, code, language = 'python') {
  const url = `${SANDBOX_URL}/run-code?sandbox_id=${encodeURIComponent(sandboxId)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: getSandboxHeaders(),
    body: JSON.stringify({ code, language }),
  })
  if (!res.ok) throw new Error(`Sandbox error: ${res.status}`)
  return res.json()
}

async function sandboxWriteFile(sandboxId, path, content) {
  const url = `${SANDBOX_URL}/files/write?sandbox_id=${encodeURIComponent(sandboxId)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: getSandboxHeaders(),
    body: JSON.stringify({ path, content }),
  })
  if (!res.ok) throw new Error(`Sandbox error: ${res.status}`)
  return res.json()
}

async function sandboxReadFile(sandboxId, path) {
  const url = `${SANDBOX_URL}/files/read?sandbox_id=${encodeURIComponent(sandboxId)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: getSandboxHeaders(),
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error(`Sandbox error: ${res.status}`)
  return res.json()
}

// ══════════════════════════════════════════
// TOOL DEFINITIONS (Groq function schemas)
// ══════════════════════════════════════════

const toolDefs = [
  // ── 1. WEB SEARCH ──
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information, real-time data, news, prices, facts, or anything that requires up-to-date knowledge. Uses multiple search providers in parallel (Tavily, Brave Search, Firecrawl, DuckDuckGo) and merges results for maximum coverage.',
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
      description: 'Execute code in a sandbox environment and return the output. Uses Cloudflare Sandbox (with internet access, pip/npm install, file system) when available, otherwise falls back to Judge0. Supports Python, JavaScript, TypeScript, Java, C++, C, Go, Rust, Bash, SQL, Ruby, PHP.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Complete source code to execute' },
          language_id: { type: 'number', description: 'Language ID: 71=Python, 63=JS, 74=TS, 62=Java, 54=C++, 50=C, 60=Go, 73=Rust, 72=Ruby, 68=PHP, 46=Bash, 82=SQL' },
          stdin: { type: 'string', description: 'Optional stdin input' },
          sandbox_id: { type: 'string', description: 'Optional sandbox ID for persistent sessions (default: "default")' }
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
  },

  // ── 21. SANDBOX EXEC ── (Daytona → Docker → Cloudflare Sandbox → Judge0)
  {
    type: 'function',
    function: {
      name: 'sandbox_exec',
      description: 'Execute a shell command in a persistent sandbox with full internet access, pip/npm install, and filesystem. Uses Daytona (primary), Docker (self-hosted fallback), or Cloudflare Sandbox. Use for installing packages, running servers, git operations, or any command-line task.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute (e.g. "pip install pandas", "npm init -y", "git clone https://...")' },
          sandbox_id: { type: 'string', description: 'Sandbox ID for session persistence (default: "default"). Same ID = same sandbox.' },
          timeout: { type: 'number', description: 'Timeout in ms (default: 30000, max: 120000)', default: 30000 }
        },
        required: ['command']
      }
    }
  },

  // ── 22. SANDBOX FILE OPERATION ──
  {
    type: 'function',
    function: {
      name: 'sandbox_file',
      description: 'Read, write, list, or manage files in the sandbox filesystem. Uses Daytona (primary), Docker (self-hosted fallback), or Cloudflare Sandbox. Use to create downloadable files (PDFs, CSVs, images, etc.), read project files, or organize a workspace.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'File operation: read, write, ls, mkdir, rm', enum: ['read', 'write', 'ls', 'mkdir', 'rm'] },
          path: { type: 'string', description: 'File or directory path (e.g. "/workspace/report.pdf", "/workspace/src/")' },
          content: { type: 'string', description: 'File content (required for write action)' },
          sandbox_id: { type: 'string', description: 'Sandbox ID (default: "default")' }
        },
        required: ['action', 'path']
      }
    }
  },

  // ── 23. SANDBOX GIT ──
  {
    type: 'function',
    function: {
      name: 'sandbox_git',
      description: 'Clone a git repository into the sandbox for analysis, modification, or building. Uses Daytona (primary), Docker (self-hosted fallback), or Cloudflare Sandbox. Use when the user wants to analyze, explore, or work with a GitHub repo.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Git repository URL (e.g. "https://github.com/user/repo")' },
          branch: { type: 'string', description: 'Branch to checkout (default: main)' },
          target_dir: { type: 'string', description: 'Target directory name in /workspace (default: repo name)' },
          sandbox_id: { type: 'string', description: 'Sandbox ID (default: "default")' }
        },
        required: ['url']
      }
    }
  },

  // ── 24. GENERATE DOWNLOADABLE FILE ──
  {
    type: 'function',
    function: {
      name: 'generate_downloadable',
      description: 'Create a file that the user can download. Supports CSV, JSON, PDF, TXT, MD, HTML, SVG, and other text-based formats. The file is created in the sandbox and a download link is returned.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'File name (e.g. "report.csv", "data.json", "diagram.svg")' },
          content: { type: 'string', description: 'File content' },
          content_type: { type: 'string', description: 'MIME type hint (e.g. text/csv, application/json, image/svg+xml)', default: 'auto-detect' }
        },
        required: ['filename', 'content']
      }
    }
  },

  // ── 25. RECOMMEND OPPORTUNITIES ──
  {
    type: 'function',
    function: {
      name: 'recommend_opportunities',
      description: 'Search the Kivora opportunity database for income opportunities, business ideas, and side hustles that match the user\'s query. Returns opportunity cards with title, income range, startup cost, and link. Use when the user asks about making money, business ideas, side hustles, income opportunities, or anything related to earning/building.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query matching the user\'s interest (e.g. "freelance writing", "WhatsApp bot business", "SaaS builder")' },
          count: { type: 'number', description: 'Number of results to return (1-5, default 3)', default: 3 }
        },
        required: ['query']
      }
    }
  },

  // ── 26. RUN ON GPU ──
  {
    type: 'function',
    function: {
      name: 'run_on_gpu',
      description: 'Execute Python code on a remote GPU or TPU runtime. Use when the user needs GPU-accelerated computing — ML training, model fine-tuning, deep learning inference, CUDA operations, large-scale data processing. Auto-selects best available GPU backend. Kaggle: free T4/P100 GPU, TPU v3-8. Colab: T4/L4/A100/H100 GPU, v5e1/v6e1/V2-8 TPU. E2B/Codespaces as CPU fallbacks.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Complete Python code to execute on the GPU/TPU runtime. Include all imports.' },
          gpu: { type: 'string', description: 'GPU type: T4 (free, 16GB), L4 (24GB), P100 (16GB), A100 (40/80GB), H100 (80GB). Default: T4', enum: ['T4', 'L4', 'P100', 'A100', 'H100'], default: 'T4' },
          tpu: { type: 'string', description: 'TPU type: v5e1, v6e1, V2-8 (Colab) or v3-8 (Kaggle).', enum: ['v5e1', 'v6e1', 'V2-8', 'v3-8'] },
          platform: { type: 'string', description: 'Force a specific platform: auto (default), daytona, docker, kaggle, colab, e2b, or codespaces.', enum: ['auto', 'daytona', 'docker', 'kaggle', 'colab', 'e2b', 'codespaces'], default: 'auto' },
          install_packages: { type: 'string', description: 'Comma-separated pip packages to install before running (e.g. "transformers,datasets,peft")' },
          timeout: { type: 'number', description: 'Timeout in seconds (default: 120, max: 300)', default: 120 },
        },
        required: ['code']
      }
    }
  },

  // ── 27. RUN CODE (Smart Executor) ──
  {
    type: 'function',
    function: {
      name: 'run_code',
      description: 'Execute code using the best available runtime. Auto-selects between E2B (fastest CPU, 150ms start), Kaggle (free GPU), Colab (premium GPU), and Codespaces (full IDE). Use for any code execution — the system picks the optimal backend. For GPU-specific tasks, prefer run_on_gpu instead.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Complete code to execute. Include all imports. Default language is Python.' },
          language: { type: 'string', description: 'Programming language: python (default), javascript, r, java, bash', enum: ['python', 'javascript', 'r', 'java', 'bash'], default: 'python' },
          platform: { type: 'string', description: 'Force a specific platform: auto (default), daytona, docker, e2b, kaggle, colab, or codespaces.', enum: ['auto', 'daytona', 'docker', 'e2b', 'kaggle', 'colab', 'codespaces'], default: 'auto' },
          install_packages: { type: 'string', description: 'Comma-separated packages to install before running (pip for Python, npm for JS)' },
          timeout: { type: 'number', description: 'Timeout in seconds (default: 120, max: 300)', default: 120 },
        },
        required: ['code']
      }
    }
  },

  // ── 28. DEPLOY SITE ──
  {
    type: 'function',
    function: {
      name: 'deploy_site',
      description: 'Deploy a website to Cloudflare Pages and return a live public URL. Use when the user wants to publish, deploy, or host a website they\'ve built. Supports multi-file sites (HTML, CSS, JS, images). The site will be live at https://<project>.pages.dev within seconds.',
      parameters: {
        type: 'object',
        properties: {
          project_name: { type: 'string', 'description': 'Unique project name for the deployed site (lowercase, hyphens only, e.g. "my-portfolio" or "weather-dashboard"). Will be used in the URL: https://<project_name>.pages.dev' },
          files: { type: 'array', items: { type: 'object', properties: { path: { type: 'string', description: 'File path relative to site root (e.g. "index.html", "css/style.css", "js/app.js")' }, content: { type: 'string', description: 'File content (text only)' } }, required: ['path', 'content'] }, description: 'Array of files to deploy. Must include at least index.html.' },
          framework: { type: 'string', description: 'Framework preset (optional): nextjs, react, vue, astro, html, static', enum: ['nextjs', 'react', 'vue', 'astro', 'html', 'static'], default: 'static' }
        },
        required: ['project_name', 'files']
      }
    }
  }
]

// ══════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════

// ── Individual search providers ──

async function searchDuckDuckGo(query) {
  try {
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) }
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
      if (results.length > 0) return results
    }
  } catch {}
  return []
}

async function searchTavily(query) {
  try {
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TAVILY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, search_depth: 'basic', include_answer: true, max_results: 5 }),
      signal: AbortSignal.timeout(8000),
    })
    if (tavilyRes.ok) {
      const data = await tavilyRes.json()
      return {
        answer: data.answer || '',
        results: (data.results || []).map(r => ({ title: r.title, url: r.url, content: r.content, score: r.score })),
      }
    }
  } catch {}
  return null
}

async function searchBrave(query, count = 8) {
  if (!BRAVE_API_KEY) return []
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      { headers: { 'X-Subscription-Token': BRAVE_API_KEY, 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.web?.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      content: r.description || '',
      score: 0,
    }))
  } catch {}
  return []
}

async function searchFirecrawl(query, limit = 8) {
  if (!FIRECRAWL_API_KEY) return []
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    if (!data.success) return []
    return (data.data || []).map(r => ({
      title: r.title || r.metadata?.title || '',
      url: r.url || r.metadata?.sourceURL || '',
      content: r.snippet || r.description || r.metadata?.description || '',
      score: 0,
    }))
  } catch {}
  return []
}

// ── Main search: run all providers in parallel, merge & deduplicate ──

async function performSearch(query) {
  // Run all available providers in parallel for maximum coverage
  const [ddgResults, tavilyData, braveResults, firecrawlResults] = await Promise.all([
    searchDuckDuckGo(query),
    searchTavily(query),
    searchBrave(query, 8),
    searchFirecrawl(query, 8),
  ])

  // Start with Tavily answer if available (best AI-generated summary)
  let answer = tavilyData?.answer || ''
  const allResults = []
  const seen = new Set()

  // Add Tavily results first (highest quality, scored)
  if (tavilyData?.results) {
    for (const r of tavilyData.results) {
      const key = r.url?.toLowerCase().replace(/\/$/, '')
      if (key && !seen.has(key)) {
        seen.add(key)
        allResults.push({ ...r, source: 'tavily' })
      }
    }
  }

  // Add Brave results
  for (const r of braveResults) {
    const key = r.url?.toLowerCase().replace(/\/$/, '')
    if (key && !seen.has(key)) {
      seen.add(key)
      allResults.push({ ...r, source: 'brave' })
    }
  }

  // Add Firecrawl results
  for (const r of firecrawlResults) {
    const key = r.url?.toLowerCase().replace(/\/$/, '')
    if (key && !seen.has(key)) {
      seen.add(key)
      allResults.push({ ...r, source: 'firecrawl' })
    }
  }

  // Add DuckDuckGo results last (often duplicates, lower quality)
  for (const r of ddgResults) {
    const key = r.url?.toLowerCase().replace(/\/$/, '')
    if (key && !seen.has(key)) {
      seen.add(key)
      allResults.push({ ...r, source: 'duckduckgo' })
    }
  }

  if (allResults.length === 0) return null

  return {
    answer,
    results: allResults.slice(0, 12),
    source: [tavilyData ? 'tavily' : null, braveResults.length ? 'brave' : null, firecrawlResults.length ? 'firecrawl' : null, ddgResults.length ? 'duckduckgo' : null].filter(Boolean).join('+'),
  }
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
      results: result.results?.map(r => ({ title: r.title, url: r.url, content: r.content?.slice(0, 500), source: r.source })),
      providers: result.source,
    })
  },

  async execute_code(args) {
    const sandboxId = args.sandbox_id || 'default'
    const langId = args.language_id

    // ── Try Cloudflare Sandbox first ──
    if (SANDBOX_AVAILABLE) {
      try {
        const langCommand = LANG_TO_SANDBOX[langId]
        if (!langCommand) throw new Error(`Unsupported language_id: ${langId}`)

        let command
        if (langId === 46) {
          // Bash — run directly
          command = args.code
        } else if (langId === 71) {
          // Python — use -c flag
          command = `python3 -c ${JSON.stringify(args.code)}`
          if (args.stdin) command = `echo ${JSON.stringify(args.stdin)} | ${command}`
        } else if (langId === 63) {
          // Node.js
          command = `node -e ${JSON.stringify(args.code)}`
        } else if (langId === 74) {
          // TypeScript — write to file and run with tsx
          const tsFile = `/workspace/_kivora_exec_${Date.now()}.ts`
          await sandboxWriteFile(sandboxId, tsFile, args.code)
          command = `npx tsx ${tsFile}`
        } else if (langId === 82) {
          // SQL — write to file and run with sqlite3
          const sqlFile = `/workspace/_kivora_exec_${Date.now()}.sql`
          await sandboxWriteFile(sandboxId, sqlFile, args.code)
          command = `sqlite3 :memory: < ${sqlFile}`
        } else if (langId === 62) {
          // Java — write to file, compile, run
          const javaFile = '/workspace/Main.java'
          await sandboxWriteFile(sandboxId, javaFile, args.code)
          command = 'cd /workspace && javac Main.java && java Main'
        } else if (langId === 54) {
          // C++
          const cppFile = '/workspace/_exec.cpp'
          await sandboxWriteFile(sandboxId, cppFile, args.code)
          command = 'cd /workspace && g++ -o _exec _exec.cpp && ./_exec'
        } else if (langId === 50) {
          // C
          const cFile = '/workspace/_exec.c'
          await sandboxWriteFile(sandboxId, cFile, args.code)
          command = 'cd /workspace && gcc -o _exec _exec.c && ./_exec'
        } else if (langId === 60) {
          // Go
          const goFile = '/workspace/_exec.go'
          await sandboxWriteFile(sandboxId, goFile, args.code)
          command = 'cd /workspace && go run _exec.go'
        } else if (langId === 73) {
          // Rust
          const rsFile = '/workspace/_exec.rs'
          await sandboxWriteFile(sandboxId, rsFile, args.code)
          command = 'cd /workspace && rustc _exec.rs -o _exec && ./_exec'
        } else if (langId === 72) {
          // Ruby
          command = `ruby -e ${JSON.stringify(args.code)}`
        } else if (langId === 68) {
          // PHP
          command = `php -r ${JSON.stringify(args.code)}`
        } else {
          throw new Error(`No sandbox mapping for language_id: ${langId}`)
        }

        const result = await sandboxExec(sandboxId, command, 30000)
        return JSON.stringify({
          success: result.success,
          status: result.success ? 'Accepted' : 'Runtime Error',
          exit_code: result.exitCode,
          output: (result.stdout || '') + (result.stderr ? '\n' + result.stderr : '') || '(no output)',
          executor: 'cloudflare-sandbox',
          sandbox_id: sandboxId,
          has_internet: true,
          has_filesystem: true,
        })
      } catch (sandboxErr) {
        console.warn('[execute_code] Sandbox failed, falling back to Judge0:', sandboxErr.message)
        // Fall through to Judge0
      }
    }

    // ── Fallback: Judge0 ──
    const result = await executeOnJudge0(args.code, langId, args.stdin)
    if (result.error) return JSON.stringify({ error: result.error })
    const STATUS_OK = new Set([3, 4])
    const isOk = STATUS_OK.has(result.status_id)
    let output = ''
    if (result.stdout) output += result.stdout
    if (result.compile_output) output += (output ? '\n' : '') + result.compile_output
    if (result.stderr) output += (output ? '\n' : '') + result.stderr
    if (!output) output = '(no output)'
    return JSON.stringify({ success: isOk, status: result.status, exit_code: result.exit_code, output, time: result.time, memory: result.memory, executor: 'judge0' })
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
  },

  // ── 21. SANDBOX EXEC ──
  async sandbox_exec(args) {
    const sandboxId = args.sandbox_id || 'default'
    const timeout = Math.min(args.timeout || 30000, 120000)

    // 1. Try Daytona first (real shell, persistent, sub-90ms cold start)
    if (DAYTONA_AVAILABLE) {
      try {
        const daytona = await import('@/lib/daytona')
        const result = await daytona.execCommand(sandboxId, args.command, {
          timeout: Math.ceil(timeout / 1000),
        })
        if (result.success) {
          return JSON.stringify({
            success: true,
            exit_code: result.exitCode,
            output: result.output || '(no output)',
            sandbox_id: sandboxId,
            executor: 'daytona',
          })
        }
        // Daytona failed — fall through to Docker
      } catch {
        // Daytona error — fall through
      }
    }

    // 2. Try Docker Sandbox (self-hosted)
    if (DOCKER_AVAILABLE) {
      try {
        const dockerSandbox = await import('@/lib/dockerSandbox')
        const result = await dockerSandbox.execCommand(sandboxId, args.command, {
          timeout: Math.ceil(timeout / 1000),
        })
        if (result.success) {
          return JSON.stringify({
            success: true,
            exit_code: result.exitCode,
            output: result.output || '(no output)',
            sandbox_id: sandboxId,
            executor: 'docker',
          })
        }
        // Docker failed — fall through to Cloudflare Sandbox
      } catch {
        // Docker error — fall through
      }
    }

    // 3. Try Cloudflare Sandbox
    if (SANDBOX_AVAILABLE) {
      try {
        const result = await sandboxExec(sandboxId, args.command, timeout)
        return JSON.stringify({
          success: result.success,
          exit_code: result.exitCode,
          output: result.output || (result.stdout || '') + (result.stderr ? '\n' + result.stderr : '') || '(no output)',
          sandbox_id: sandboxId,
          executor: 'cloudflare-sandbox',
        })
      } catch (err) {
        return JSON.stringify({ error: `Sandbox exec failed: ${err.message}` })
      }
    }

    // 4. Fallback: Judge0 with Bash
    const result = await executeOnJudge0(args.command, 46)
    if (result.error) return JSON.stringify({ error: result.error })
    const isOk = new Set([3, 4]).has(result.status_id)
    let output = ''
    if (result.stdout) output += result.stdout
    if (result.compile_output) output += (output ? '\n' : '') + result.compile_output
    if (result.stderr) output += (output ? '\n' : '') + result.stderr
    if (!output) output = '(no output)'
    return JSON.stringify({ success: isOk, exit_code: result.exit_code, output, executor: 'judge0-fallback' })
  },

  // ── 22. SANDBOX FILE ──
  async sandbox_file(args) {
    const sandboxId = args.sandbox_id || 'default'
    const action = args.action
    const path = args.path

    // 1. Try Daytona first
    if (DAYTONA_AVAILABLE) {
      try {
        const daytona = await import('@/lib/daytona')

        if (action === 'write') {
          if (!args.content && args.content !== '') return JSON.stringify({ error: 'content is required for write action' })
          const result = await daytona.writeFile(sandboxId, path, args.content)
          if (result.success) {
            return JSON.stringify({ success: true, action: 'write', path, sandbox_id: sandboxId, executor: 'daytona' })
          }
          // Daytona failed — fall through
        }

        if (action === 'read') {
          const result = await daytona.readFile(sandboxId, path)
          if (result.success) {
            return JSON.stringify({ success: true, action: 'read', path, content: result.content, sandbox_id: sandboxId, executor: 'daytona' })
          }
          // Daytona failed — fall through
        }

        if (action === 'ls') {
          const result = await daytona.listFiles(sandboxId, path)
          if (result.success) {
            return JSON.stringify({ success: true, action: 'ls', path, files: result.files, sandbox_id: sandboxId, executor: 'daytona' })
          }
          // Daytona failed — fall through
        }

        if (action === 'mkdir') {
          const result = await daytona.createFolder(sandboxId, path)
          if (result.success) {
            return JSON.stringify({ success: true, action: 'mkdir', path, sandbox_id: sandboxId, executor: 'daytona' })
          }
          // Daytona failed — fall through
        }

        if (action === 'rm') {
          // Daytona doesn't have a direct rm — use shell command
          const result = await daytona.execCommand(sandboxId, `rm -rf ${path}`)
          if (result.success) {
            return JSON.stringify({ success: true, action: 'rm', path, sandbox_id: sandboxId, executor: 'daytona' })
          }
          // Daytona failed — fall through
        }

        if (!['write', 'read', 'ls', 'mkdir', 'rm'].includes(action)) {
          return JSON.stringify({ error: `Unknown action: ${action}` })
        }
      } catch {
        // Daytona error — fall through to Docker
      }
    }

    // 2. Try Docker Sandbox (self-hosted)
    if (DOCKER_AVAILABLE) {
      try {
        const dockerSandbox = await import('@/lib/dockerSandbox')

        if (action === 'write') {
          if (!args.content && args.content !== '') return JSON.stringify({ error: 'content is required for write action' })
          const result = await dockerSandbox.writeFile(sandboxId, path, args.content)
          if (result.success) {
            return JSON.stringify({ success: true, action: 'write', path, sandbox_id: sandboxId, executor: 'docker' })
          }
        }

        if (action === 'read') {
          const result = await dockerSandbox.readFile(sandboxId, path)
          if (result.success) {
            return JSON.stringify({ success: true, action: 'read', path, content: result.content, sandbox_id: sandboxId, executor: 'docker' })
          }
        }

        if (action === 'ls') {
          const result = await dockerSandbox.listFiles(sandboxId, path)
          if (result.success) {
            return JSON.stringify({ success: true, action: 'ls', path, files: result.files, sandbox_id: sandboxId, executor: 'docker' })
          }
        }

        if (action === 'mkdir') {
          const result = await dockerSandbox.createFolder(sandboxId, path)
          if (result.success) {
            return JSON.stringify({ success: true, action: 'mkdir', path, sandbox_id: sandboxId, executor: 'docker' })
          }
        }

        if (action === 'rm') {
          const result = await dockerSandbox.execCommand(sandboxId, `rm -rf ${path}`)
          if (result.success) {
            return JSON.stringify({ success: true, action: 'rm', path, sandbox_id: sandboxId, executor: 'docker' })
          }
        }

        if (!['write', 'read', 'ls', 'mkdir', 'rm'].includes(action)) {
          return JSON.stringify({ error: `Unknown action: ${action}` })
        }
      } catch {
        // Docker error — fall through to Cloudflare Sandbox
      }
    }

    // 3. Try Cloudflare Sandbox
    if (SANDBOX_AVAILABLE) {
      try {
        if (action === 'write') {
          if (!args.content && args.content !== '') return JSON.stringify({ error: 'content is required for write action' })
          await sandboxWriteFile(sandboxId, path, args.content)
          return JSON.stringify({ success: true, action: 'write', path, sandbox_id: sandboxId, download_available: true })
        }

        if (action === 'read') {
          const result = await sandboxReadFile(sandboxId, path)
          return JSON.stringify({ success: true, action: 'read', path, content: result.content, sandbox_id: sandboxId })
        }

        if (action === 'ls') {
          const url = `${SANDBOX_URL}/files/ls?sandbox_id=${encodeURIComponent(sandboxId)}`
          const res = await fetch(url, { method: 'POST', headers: getSandboxHeaders(), body: JSON.stringify({ path }) })
          if (!res.ok) throw new Error(`Sandbox ls failed: ${res.status}`)
          const data = await res.json()
          return JSON.stringify({ success: true, action: 'ls', path, files: data.files, sandbox_id: sandboxId })
        }

        if (action === 'mkdir') {
          await sandboxWriteFile(sandboxId, path, '')
          return JSON.stringify({ success: true, action: 'mkdir', path, sandbox_id: sandboxId })
        }

        if (action === 'rm') {
          const url = `${SANDBOX_URL}/files/rm?sandbox_id=${encodeURIComponent(sandboxId)}`
          const res = await fetch(url, { method: 'POST', headers: getSandboxHeaders(), body: JSON.stringify({ path }) })
          if (!res.ok) throw new Error(`Sandbox rm failed: ${res.status}`)
          return JSON.stringify({ success: true, action: 'rm', path, sandbox_id: sandboxId })
        }

        return JSON.stringify({ error: `Unknown action: ${action}` })
      } catch (err) {
        return JSON.stringify({ error: `Sandbox file operation failed: ${err.message}` })
      }
    }

    // 4. No sandbox available
    return JSON.stringify({ error: 'No sandbox provider configured. Set DAYTONA_API_KEY, DOCKER_HOST_URL, or KIVORA_SANDBOX_URL for file operations.' })
  },

  // ── 23. SANDBOX GIT ──
  async sandbox_git(args) {
    const sandboxId = args.sandbox_id || 'default'
    const repoUrl = args.url
    const branch = args.branch
    const targetDir = args.target_dir || repoUrl.split('/').pop()?.replace('.git', '') || 'repo'

    // 1. Try Daytona first
    if (DAYTONA_AVAILABLE) {
      try {
        const daytona = await import('@/lib/daytona')
        const result = await daytona.gitClone(sandboxId, repoUrl, { branch, targetDir })
        if (result.success) {
          return JSON.stringify({ success: true, url: repoUrl, target: `workspace/${targetDir}`, output: result.output, sandbox_id: sandboxId, executor: 'daytona' })
        }
        // Daytona failed — fall through to Docker
      } catch {
        // Daytona error — fall through
      }
    }

    // 2. Try Docker Sandbox (self-hosted)
    if (DOCKER_AVAILABLE) {
      try {
        const dockerSandbox = await import('@/lib/dockerSandbox')
        const result = await dockerSandbox.gitClone(sandboxId, repoUrl, { branch, targetDir: `/workspace/${targetDir}` })
        if (result.success) {
          return JSON.stringify({ success: true, url: repoUrl, target: `/workspace/${targetDir}`, output: result.output, sandbox_id: sandboxId, executor: 'docker' })
        }
        // Docker failed — fall through
      } catch {
        // Docker error — fall through
      }
    }

    // 3. Try Cloudflare Sandbox
    if (SANDBOX_AVAILABLE) {
      try {
        const branchArg = branch ? ` --branch ${branch}` : ''
        const result = await sandboxExec(sandboxId, `git clone --depth 1${branchArg} ${repoUrl} /workspace/${targetDir}`, 60000)
        if (result.success) {
          return JSON.stringify({ success: true, url: repoUrl, target: `/workspace/${targetDir}`, output: result.output || result.stdout, sandbox_id: sandboxId })
        }
        return JSON.stringify({ success: false, error: result.stderr || result.output, url: repoUrl })
      } catch (err) {
        return JSON.stringify({ error: `Git clone failed: ${err.message}` })
      }
    }

    // 4. No sandbox available
    return JSON.stringify({ error: 'No sandbox provider configured. Set DAYTONA_API_KEY, DOCKER_HOST_URL, or KIVORA_SANDBOX_URL for git operations.' })
  },

  // ── 24. GENERATE DOWNLOADABLE ──
  async generate_downloadable(args) {
    const filename = args.filename
    const content = args.content

    // If sandbox is available, write file there and return download URL
    if (SANDBOX_AVAILABLE) {
      try {
        const sandboxId = 'downloads'
        const filePath = `/workspace/downloads/${filename}`
        await sandboxWriteFile(sandboxId, filePath, content)
        // Return a download URL that the frontend can use
        // The download endpoint accepts POST with {path} in body
        const downloadUrl = `${SANDBOX_URL}/files/download?sandbox_id=${encodeURIComponent(sandboxId)}`
        return JSON.stringify({
          success: true,
          filename,
          path: filePath,
          download_url: downloadUrl,
          download_body: JSON.stringify({ path: filePath }),
          size: content.length,
          executor: 'cloudflare-sandbox',
        })
      } catch (err) {
        // Fall through to base64 fallback
      }
    }

    // Fallback: return base64 data URL for client-side download
    const extToMime = {
      csv: 'text/csv', json: 'application/json', txt: 'text/plain', md: 'text/markdown',
      html: 'text/html', svg: 'image/svg+xml', xml: 'text/xml', yaml: 'text/yaml',
      py: 'text/x-python', js: 'text/javascript', ts: 'text/typescript',
    }
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt'
    const mime = extToMime[ext] || args.content_type || 'application/octet-stream'

    // For text content, use data URI
    const base64 = typeof btoa !== 'undefined'
      ? btoa(unescape(encodeURIComponent(content)))
      : Buffer.from(content).toString('base64')

    return JSON.stringify({
      success: true,
      filename,
      data_url: `data:${mime};base64,${base64}`,
      size: content.length,
      executor: 'base64-fallback',
    })
  },

  async recommend_opportunities(args, ctx) {
    const count = Math.min(Math.max(args.count || 3, 1), 5)
    const query = args.query.toLowerCase()
    try {
      const supabase = ctx?.supabaseAdmin
      if (!supabase) return JSON.stringify({ opportunities: [], note: 'Database not available' })

      // Search by query match in title or category
      const { data: results } = await supabase
        .from('explore_cache')
        .select('slug, query, result, views, category')
        .or(`query.ilike.%${query}%,category.ilike.%${query}%`)
        .order('views', { ascending: false })
        .limit(count * 3)

      if (!results || results.length === 0) {
        // Fallback: get popular opportunities
        const { data: fallback } = await supabase
          .from('explore_cache')
          .select('slug, query, result, views, category')
          .order('views', { ascending: false })
          .limit(count)

        if (!fallback || fallback.length === 0) {
          return JSON.stringify({ opportunities: [], note: 'No matching opportunities found' })
        }

        const opps = fallback.map(o => ({
          slug: o.slug,
          title: o.result?.title || o.query,
          income_min: o.result?.income_min || 0,
          income_max: o.result?.income_max || 0,
          income_period: o.result?.income_period || 'mo',
          start_days: o.result?.start_days || 0,
          monthly_cost: o.result?.monthly_cost || 0,
          category: o.category,
          tags: (o.result?.tags || []).slice(0, 3),
          url: `/explore/${o.slug}`
        }))
        return JSON.stringify({ opportunities: opps })
      }

      // Score results by relevance
      const scored = results.map(r => {
        let score = 0
        const title = (r.result?.title || r.query || '').toLowerCase()
        const tags = (r.result?.tags || []).join(' ').toLowerCase()
        const cat = (r.category || '').toLowerCase()
        if (title.includes(query)) score += 3
        if (tags.includes(query)) score += 2
        if (cat.includes(query)) score += 1
        score += (r.views || 0) * 0.001
        return { ...r, score }
      }).sort((a, b) => b.score - a.score)

      const opps = scored.slice(0, count).map(o => ({
        slug: o.slug,
        title: o.result?.title || o.query,
        income_min: o.result?.income_min || 0,
        income_max: o.result?.income_max || 0,
        income_period: o.result?.income_period || 'mo',
        start_days: o.result?.start_days || 0,
        monthly_cost: o.result?.monthly_cost || 0,
        category: o.category,
        tags: (o.result?.tags || []).slice(0, 3),
        url: `/explore/${o.slug}`
      }))

      return JSON.stringify({ opportunities: opps })
    } catch (err) {
      return JSON.stringify({ opportunities: [], error: err.message })
    }
  },

  async run_on_gpu(args) {
    try {
      const { executeWithRouting, registerBackend, getAvailableBackends } = await import('@/lib/codeExecutor')

      // Register available backends
      try {
        const daytonaModule = await import('@/lib/daytona')
        registerBackend('daytona', daytonaModule.isDaytonaAvailable, 'daytona')
      } catch {}
      try {
        const dockerModule = await import('@/lib/dockerSandbox')
        registerBackend('docker', dockerModule.isDockerSandboxAvailable, 'docker')
      } catch {}
      try {
        const colabModule = await import('@/lib/colab')
        registerBackend('colab', colabModule.isColabAvailable, 'colab')
      } catch {}
      try {
        const kaggleModule = await import('@/lib/kaggle')
        registerBackend('kaggle', kaggleModule.isKaggleAvailable, 'kaggle')
      } catch {}
      try {
        const e2bModule = await import('@/lib/e2b')
        registerBackend('e2b', e2bModule.isE2BAvailable, 'e2b')
      } catch {}
      try {
        const csModule = await import('@/lib/codespaces')
        registerBackend('codespaces', csModule.isCodespacesAvailable, 'codespaces')
      } catch {}

      const result = await executeWithRouting(args.code, {
        needsGpu: true,
        gpu: args.gpu || 'T4',
        tpu: args.tpu,
        language: 'python',
        installPackages: args.install_packages
          ? args.install_packages.split(',').map(p => p.trim()).filter(Boolean)
          : [],
        timeout: args.timeout || 120,
        preferredPlatform: args.platform || 'auto',
      })

      return JSON.stringify({
        success: result.success,
        output: result.output || '(no output)',
        error: result.error || null,
        executor: result.executor || result.backend,
        backend: result.backend,
        backendName: result.backendName,
        accelerator: result.accelerator || args.gpu || 'T4',
        acceleratorName: result.acceleratorName,
        files: result.files || [],
        sessionUsed: result.sessionUsed,
        note: result.note,
        fallback: result.fallback,
        suggestion: result.suggestion,
      })
    } catch (err) {
      return JSON.stringify({
        error: `GPU execution failed: ${err.message}. Try execute_code for CPU execution instead.`,
        fallback: 'cpu',
      })
    }
  },

  async run_code(args) {
    try {
      const { executeWithRouting, registerBackend } = await import('@/lib/codeExecutor')

      // Register available backends
      try {
        const daytonaModule = await import('@/lib/daytona')
        registerBackend('daytona', daytonaModule.isDaytonaAvailable, 'daytona')
      } catch {}
      try {
        const dockerModule = await import('@/lib/dockerSandbox')
        registerBackend('docker', dockerModule.isDockerSandboxAvailable, 'docker')
      } catch {}
      try {
        const e2bModule = await import('@/lib/e2b')
        registerBackend('e2b', e2bModule.isE2BAvailable, 'e2b')
      } catch {}
      try {
        const kaggleModule = await import('@/lib/kaggle')
        registerBackend('kaggle', kaggleModule.isKaggleAvailable, 'kaggle')
      } catch {}
      try {
        const colabModule = await import('@/lib/colab')
        registerBackend('colab', colabModule.isColabAvailable, 'colab')
      } catch {}
      try {
        const csModule = await import('@/lib/codespaces')
        registerBackend('codespaces', csModule.isCodespacesAvailable, 'codespaces')
      } catch {}

      const result = await executeWithRouting(args.code, {
        needsGpu: false,
        language: args.language || 'python',
        installPackages: args.install_packages
          ? args.install_packages.split(',').map(p => p.trim()).filter(Boolean)
          : [],
        timeout: args.timeout || 120,
        preferredPlatform: args.platform || 'auto',
      })

      return JSON.stringify({
        success: result.success,
        output: result.output || '(no output)',
        error: result.error || null,
        executor: result.executor || result.backend,
        backend: result.backend,
        backendName: result.backendName,
        accelerator: result.accelerator || 'cpu',
        results: result.results,
        logs: result.logs,
        fallback: result.fallback,
        suggestion: result.suggestion,
      })
    } catch (err) {
      return JSON.stringify({
        error: `Code execution failed: ${err.message}. Try execute_code as a fallback.`,
        fallback: 'cpu',
      })
    }
  },

  async deploy_site(args, ctx) {
    // Read CF credentials from toolContext (passed by route.js via getEnvVar)
    // — on Cloudflare Pages, process.env has empty values for secret_text vars,
    // so the route must look them up via getOptionalRequestContext() and pass
    // them down here.
    const CF_API_TOKEN = ctx?.cfApiToken || process.env.CF_API_TOKEN || ''
    let CF_ACCOUNT_ID = ctx?.cfAccountId || process.env.CF_ACCOUNT_ID || ''

    if (!CF_API_TOKEN) return JSON.stringify({ success: false, error: 'Cloudflare API token not configured. Set CF_API_TOKEN env var on the Kivora Pages project.' })
    if (!args.files?.length) return JSON.stringify({ success: false, error: 'No files provided for deployment.' })

    // Auto-detect account ID from API token if not explicitly set
    if (!CF_ACCOUNT_ID) {
      try {
        const accRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
          headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` },
          signal: AbortSignal.timeout(8000),
        })
        if (accRes.ok) {
          const accData = await accRes.json()
          if (accData.success && accData.result?.length > 0) {
            CF_ACCOUNT_ID = accData.result[0].id
          }
        }
      } catch { /* auto-detect failed */ }
    }

    if (!CF_ACCOUNT_ID) return JSON.stringify({ success: false, error: 'Cloudflare Account ID not configured. Set CF_ACCOUNT_ID env var, or ensure your API token has Account Read permission.' })

    const projectName = args.project_name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!projectName) return JSON.stringify({ success: false, error: 'Invalid project name.' })

    // ── Cloudflare Pages direct-upload flow (matches wrangler's implementation) ──
    // Reference: wrangler/wrangler-dist/cli.js lines 240975-241355
    //
    // Steps:
    //   1. Create project (idempotent — failure if exists is ignored)
    //   2. Get upload JWT from /accounts/:id/pages/projects/:name/upload-token
    //   3. Check which file hashes are missing (POST /pages/assets/check-missing)
    //   4. Upload missing files (base64-encoded, JSON payload) to /pages/assets/upload
    //   5. Upsert hashes (POST /pages/assets/upsert-hashes)
    //   6. Create deployment with manifest (multipart form-data with "manifest" field)
    //
    // The OLD implementation tried a single multipart upload with file blobs to the
    // deployments endpoint — Cloudflare no longer accepts that and returns:
    //   {"errors":[{"code":8000096,"message":"A \"manifest\" field was expected in the request body but was not provided."}]}
    try {
      // 1. Create project (idempotent — failure if exists is fine)
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectName,
            production_branch: 'main',
            ...(args.framework && args.framework !== 'static'
              ? { build_config: { framework: args.framework, build_command: 'npm run build', output_directory: 'dist' } }
              : {}),
          }),
          signal: AbortSignal.timeout(15000),
        }
      )
      // Don't check createRes status — project may already exist (code 8000002)

      // 2. Get upload JWT
      const tokenRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/upload-token`,
        { headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }, signal: AbortSignal.timeout(10000) }
      )
      if (!tokenRes.ok) {
        const errText = await tokenRes.text()
        return JSON.stringify({ success: false, error: `Failed to get upload token (${tokenRes.status}): ${errText.slice(0, 200)}` })
      }
      const tokenData = await tokenRes.json()
      const jwt = tokenData.result?.jwt
      if (!jwt) return JSON.stringify({ success: false, error: 'No JWT in upload-token response' })

      // Compute SHA-1 hashes for each file (Cloudflare uses SHA-1 of raw bytes)
      const fileEntries = args.files.map(f => {
        const content = typeof f.content === 'string' ? f.content : String(f.content)
        const bytes = new TextEncoder().encode(content)
        // SHA-1 via crypto.subtle (available in Workers runtime)
        return {
          path: f.path.startsWith('/') ? f.path : '/' + f.path,
          content,
          bytes,
          // Hash computed below (async)
        }
      })

      // Compute SHA-1 hashes in parallel
      const hashes = await Promise.all(fileEntries.map(async f => {
        const hashBuf = await crypto.subtle.digest('SHA-1', f.bytes)
        const hashHex = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('')
        return hashHex
      }))
      fileEntries.forEach((f, i) => { f.hash = hashes[i] })

      // 3. Check which hashes are missing (need upload)
      const checkRes = await fetch('https://api.cloudflare.com/client/v4/pages/assets/check-missing', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashes: hashes }),
        signal: AbortSignal.timeout(10000),
      })
      if (!checkRes.ok) {
        const errText = await checkRes.text()
        return JSON.stringify({ success: false, error: `check-missing failed (${checkRes.status}): ${errText.slice(0, 200)}` })
      }
      const checkData = await checkRes.json()
      const missingHashes = checkData.result || []

      // 4. Upload missing files (base64-encoded)
      const filesToUpload = fileEntries.filter(f => missingHashes.includes(f.hash))
      if (filesToUpload.length > 0) {
        // Cloudflare expects the upload payload as JSON array of {key, value, metadata, base64}
        // Convert each file's bytes to base64 manually (btoa doesn't handle UTF-8 well)
        const uploadPayload = filesToUpload.map(f => {
          // Convert Uint8Array to base64
          let binary = ''
          for (let i = 0; i < f.bytes.length; i++) binary += String.fromCharCode(f.bytes[i])
          const base64 = btoa(binary)
          // Guess content type from extension
          const ext = f.path.split('.').pop().toLowerCase()
          const contentType = {
            'html': 'text/html', 'htm': 'text/html', 'css': 'text/css',
            'js': 'text/javascript', 'mjs': 'text/javascript',
            'json': 'application/json', 'svg': 'image/svg+xml',
            'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'gif': 'image/gif', 'webp': 'image/webp', 'ico': 'image/x-icon',
            'txt': 'text/plain', 'xml': 'application/xml', 'woff': 'font/woff',
            'woff2': 'font/woff2', 'ttf': 'font/ttf', 'otf': 'font/otf',
          }[ext] || 'application/octet-stream'
          return {
            key: f.hash,
            value: base64,
            metadata: { contentType },
            base64: true,
          }
        })
        const uploadRes = await fetch('https://api.cloudflare.com/client/v4/pages/assets/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(uploadPayload),
          signal: AbortSignal.timeout(30000),
        })
        if (!uploadRes.ok) {
          const errText = await uploadRes.text()
          return JSON.stringify({ success: false, error: `assets/upload failed (${uploadRes.status}): ${errText.slice(0, 300)}` })
        }
      }

      // 5. Upsert hashes (registers them in Cloudflare's asset cache for future deploys)
      await fetch('https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashes }),
        signal: AbortSignal.timeout(10000),
      })
      // Don't check status — upsert is best-effort, deploy will still work

      // 6. Create deployment with manifest (multipart form-data)
      // This is the critical fix — the manifest must be a form field, not a JSON body.
      // Cloudflare returns 400 "A manifest field was expected" if you send it as JSON.
      const manifest = {}
      for (const f of fileEntries) {
        manifest[f.path] = { hash: f.hash, size: f.bytes.length }
      }
      const formData = new FormData()
      formData.append('manifest', JSON.stringify(manifest))

      const deployRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` },
          body: formData,
          signal: AbortSignal.timeout(30000),
        }
      )
      if (!deployRes.ok) {
        const errText = await deployRes.text()
        return JSON.stringify({ success: false, error: `Deploy failed (${deployRes.status}): ${errText.slice(0, 500)}` })
      }
      const deployData = await deployRes.json()
      if (!deployData.success) {
        return JSON.stringify({ success: false, error: deployData.errors?.[0]?.message || 'Deploy failed' })
      }

      const url = deployData.result?.url || `https://${projectName}.pages.dev`
      const subdomain = deployData.result?.subdomain || projectName

      return JSON.stringify({
        success: true,
        url,
        project_name: projectName,
        subdomain,
        files_deployed: args.files.length,
        message: `Site deployed! Live at: ${url}`,
      })
    } catch (err) {
      return JSON.stringify({ success: false, error: `Deploy error: ${err.message}` })
    }
  }
}

// ══════════════════════════════════════════
// TOOL INSTRUCTIONS (injected into system prompt)
// ══════════════════════════════════════════

const TOOL_INSTRUCTIONS = `

QUICK REFERENCE — Your 28 tools:
Search: web_search, search_wikipedia, search_news, search_images
Code: execute_code, calculate_math, format_json, run_on_gpu, run_code
URL: read_url, web_scrape, check_website
Finance: get_exchange_rate, get_crypto_price, get_stock_price
Weather/Maps: get_weather, generate_map
Media: generate_image, generate_qr_code, color_palette
Language: translate_text, search_past_chats
Opportunities: recommend_opportunities
Sandbox: sandbox_exec, sandbox_file, sandbox_git, generate_downloadable
Deploy: deploy_site

ARTIFACT FORMAT:
<artifact type="html|svg|mermaid|markdown|react|project" title="Descriptive Title">
...complete self-contained code...
</artifact>

For multi-file websites, use the project type:
<artifact type="project" title="My Website">
<file path="index.html">
...HTML content...
</file>
<file path="css/style.css">
...CSS content...
</file>
<file path="js/app.js">
...JS content...
</file>
</artifact>

Artifact types: html (web pages/dashboards/tools), svg (graphics/icons), mermaid (diagrams/flowcharts), markdown (documents/reports), react (interactive components), project (multi-file websites with file tree)
Rules: Complete code only. HTML needs <!DOCTYPE html>, full <head>, <body>, inline styles/scripts. Responsive by default. No external deps except CDN. Maps use Leaflet+OSM in HTML artifact. For multi-file sites, use project type with <file> tags.

SANDBOX TOOLS (Cloudflare Sandbox with persistent file storage):
- sandbox_exec: Run shell commands (executed via Judge0, with sandbox-first routing)
- sandbox_file: Read/write/list/delete files in sandbox workspace (persistent DO SQLite storage)
- sandbox_git: Clone git repos into sandbox for analysis
- generate_downloadable: Create files user can download (CSV, JSON, PDF, SVG, etc.)
- execute_code: Also uses sandbox when available (auto-fallback to Judge0)

DOWNLOADABLE FILES:
When user wants a downloadable file, use generate_downloadable tool. It works with or without sandbox.
With sandbox: file is stored in sandbox DO storage, download URL returned
Without sandbox: base64 data URL is returned for client-side download

OPPORTUNITY RECOMMENDATIONS:
- recommend_opportunities: Search the Kivora opportunity database for income/business/side-hustle opportunities
- Use when the user asks about making money, starting a business, side hustles, or income opportunities
- Use when the user discusses a topic that could relate to an earning opportunity (e.g. coding → freelance dev, writing → content agency)
- Use 1-3 results for subtle suggestions, up to 5 when the user explicitly asks for opportunities
- Don't force recommendations when they're clearly irrelevant to the conversation

SMART CODE EXECUTION (4 backends with auto-routing):
- run_code: General code execution — auto-picks the best available backend
- run_on_gpu: GPU/TPU execution — routes to GPU-capable backends first
- Backends (priority order for auto-selection):
  1. E2B: Fastest CPU execution (150ms cold start, Firecracker VM, Jupyter stateful). Supports Python/JS/R/Java/Bash. Needs E2B_API_KEY.
  2. Kaggle: Free GPU (T4/P100) + TPU v3-8. Best for ML training. Needs KAGGLE_USERNAME + KAGGLE_KEY.
  3. Colab: Premium GPUs (L4/A100/H100) + advanced TPUs. Best for heavy ML. Needs GOOGLE_COLAB_ACCESS_TOKEN.
  4. Codespaces: Full dev environment, any language, up to 64GB RAM. Best for full-stack tasks. Needs GITHUB_TOKEN.
- Smart routing: GPU tasks → Kaggle/Colab first. CPU tasks → E2B first. Full IDE → Codespaces.
- Cross-fallback: if primary backend fails, automatically tries the next available one
- User can force a specific platform with the "platform" param: auto, e2b, kaggle, colab, codespaces
- If no backend is available, suggest Kaggle as easiest setup (API key only, free T4 GPU)
- Max timeout is 300 seconds; default is 120 seconds
- For simple CPU Python, execute_code (Judge0) is fine. Use run_code/rung_on_gpu when E2B/Kaggle/Colab features are needed

DEPLOY SITE:
- deploy_site: Deploy a website to Cloudflare Pages and get a live URL (https://<project>.pages.dev)
- Use when the user wants to publish, deploy, or host a website they've built
- Supports multi-file sites (HTML, CSS, JS, images). Must include index.html
- project_name: lowercase, hyphens only (e.g. "my-portfolio", "weather-dashboard")
- framework: optional preset (nextjs, react, vue, astro, html, static). Default: static
- Files are deployed via direct upload — no git repo needed
- Site goes live within seconds at the returned URL
- Can also be triggered from the frontend via the /api/deploy endpoint

DEPLOY_SITE WORKFLOW — CRITICAL (avoid premature deploy):
- If the user says "create a website" / "build a site" / "make a page" WITHOUT specs, DO NOT immediately call deploy_site. First ask 2-3 quick clarifying questions in plain text:
    1. Purpose/topic (portfolio, landing page, dashboard, blog, game...)
    2. Style preference (minimal, dark, colorful, corporate, playful...)
    3. Any must-have sections (hero, contact form, gallery, pricing, etc.)
  Then build the full HTML/CSS/JS and call deploy_site with complete files.
- Only call deploy_site when you have enough detail to write the complete site. If the user's request is genuinely specific ("a hello world page"), proceed without questions.
- After successful deploy, briefly describe what you built (sections, features) and surface the live URL. Do NOT mention Cloudflare, API tokens, deployment internals, or "missing configuration" — the user doesn't need to know any of that.
- If deploy_site returns { success: false }, do NOT tell the user "Cloudflare API token not configured" or any infrastructure detail. Just say something like "I hit a snag deploying — let me show you the code instead" and provide the artifact, then offer to retry later.
- Never expose internal tool name "deploy_site" or any error message containing "CF_API_TOKEN", "env var", "Cloudflare API", "Account ID" to the user.`

export { toolDefs, toolHandlers, TOOL_INSTRUCTIONS, performSearch, readUrl }
