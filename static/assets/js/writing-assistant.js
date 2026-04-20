/* ================================================================
   Writing Assistant Widget - Trending Topics, SEO Headlines, Talking Points
   Pure JS, no API keys, instant
   ================================================================ */
(function() {
  'use strict';

  var RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
  var FEEDS = [
    'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
    'http://feeds.bbci.co.uk/news/business/rss.xml',
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'http://feeds.bbci.co.uk/news/world/rss.xml'
  ];

  /* ---- Keyword theme clusters ---- */
  var THEMES = {
    'AI & Technology': ['ai','artificial intelligence','machine learning','chatgpt','openai','tech giant','silicon','semiconductor','chip','nvidia','google','apple','meta','algorithm','automation','robot'],
    'Economy & Markets': ['economy','market','stock','inflation','fed','federal reserve','interest rate','gdp','recession','bond','treasury','wall street','trading','investor','s&p','nasdaq','dow'],
    'Energy & Commodities': ['oil','gas','opec','energy','crude','petroleum','gold','copper','lithium','renewable','solar','wind','nuclear','battery','carbon','emissions'],
    'Geopolitics & Conflict': ['war','military','nato','russia','ukraine','china','taiwan','israel','gaza','iran','sanction','treaty','summit','diplomacy','ceasefire','nuclear','defense'],
    'Finance & Banking': ['bank','credit','loan','mortgage','fintech','crypto','bitcoin','defi','regulation','sec','imf','world bank','debt','default','currency','forex','dollar','euro'],
    'Health & Pharma': ['health','drug','vaccine','fda','pharma','disease','pandemic','who','hospital','cancer','obesity','mental health','treatment','clinical','trial','gene'],
    'Climate & Environment': ['climate','flood','drought','wildfire','hurricane','temperature','arctic','glacier','biodiversity','species','pollution','plastic','ocean','ice','melting'],
    'Africa & Emerging Markets': ['africa','nigeria','kenya','south africa','ghana','ethiopia','emerging market','developing','foreign investment','infrastructure','mining','agriculture'],
    'Trade & Commerce': ['tariff','trade','export','import','supply chain','logistics','manufacturing','retail','consumer','spending','ecommerce','amazon','walmart'],
    'Politics & Policy': ['election','president','congress','parliament','vote','democracy','legislation','bill','law','policy','reform','immigration','tax','government']
  };

  var HEADLINE_TEMPLATES = [
    'The {theme} Shift: What {subject} Means for Global Markets in 2026',
    '{subject} Reshapes {theme} Landscape as Investors React',
    'Inside the {subject} Wave: How {theme} Is Being Transformed',
    'Why {subject} Could Redefine {theme} Strategy This Quarter',
    '{subject} and the Future of {theme}: An In-Depth Analysis',
    'Breaking Down {subject}: The {theme} Impact Nobody Saw Coming',
    '{subject} Explained: What It Means for {theme} and Your Portfolio',
    'The Hidden {theme} Risks Behind the {subject} Headlines',
    'From Crisis to Opportunity: How {subject} Is Reshaping {theme}',
    '{subject} Signals a New Era for {theme} -- Here Is What to Know'
  ];

  /* ---- State ---- */
  var headlines = [];
  var trendingTopics = [];
  var talkingPoints = [];
  var currentTopic = null;

  /* ---- Fetch ---- */
  function fetchFeed(url) {
    return fetch(RSS2JSON + encodeURIComponent(url))
      .then(function(r) { if (!r.ok) return null; return r.json(); })
      .then(function(data) {
        if (!data || data.status !== 'ok' || !data.items) return [];
        return data.items.map(function(i) { return i.title; });
      })
      .catch(function() { return []; });
  }

  function fetchAll() {
    return Promise.all(FEEDS.map(fetchFeed)).then(function(results) {
      headlines = [];
      results.forEach(function(arr) { headlines = headlines.concat(arr); });
      return headlines;
    });
  }

  /* ---- Trend detection ---- */
  function detectTrends() {
    var themeScores = {};
    var themeExamples = {};
    var themeCount = {};

    Object.keys(THEMES).forEach(function(theme) {
      themeScores[theme] = 0;
      themeExamples[theme] = [];
      themeCount[theme] = 0;
    });

    headlines.forEach(function(headline) {
      var h = headline.toLowerCase();
      Object.keys(THEMES).forEach(function(theme) {
        THEMES[theme].forEach(function(kw) {
          if (h.indexOf(kw) !== -1) {
            themeScores[theme]++;
            themeCount[theme]++;
            if (themeExamples[theme].length < 2) {
              themeExamples[theme].push(headline);
            }
          }
        });
      });
    });

    /* Sort by score and take top 8 */
    trendingTopics = Object.keys(themeScores)
      .filter(function(t) { return themeScores[t] > 0; })
      .sort(function(a, b) { return themeScores[b] - themeScores[a]; })
      .slice(0, 8)
      .map(function(theme) {
        return {
          theme: theme,
          score: themeScores[theme],
          examples: themeExamples[theme],
          heat: themeScores[theme] >= 10 ? 'hot' : (themeScores[theme] >= 5 ? 'warm' : 'cool')
        };
      });
  }

  /* ---- Talking points ---- */
  function extractTalkingPoints() {
    talkingPoints = [];
    var usedThemes = {};

    headlines.forEach(function(headline) {
      var h = headline.toLowerCase();
      Object.keys(THEMES).forEach(function(theme) {
        if (usedThemes[theme]) return;
        THEMES[theme].forEach(function(kw) {
          if (usedThemes[theme]) return;
          if (h.indexOf(kw) !== -1) {
            usedThemes[theme] = true;
            /* Extract the key phrase around the keyword */
            var idx = h.indexOf(kw);
            var start = Math.max(0, idx - 40);
            var end = Math.min(h.length, idx + kw.length + 60);
            var phrase = h.substring(start, end).replace(/^\s+|\s+$/g, '');
            if (start > 0) phrase = '...' + phrase;
            if (end < h.length) phrase = phrase + '...';
            talkingPoints.push({
              theme: theme,
              point: headline,
              context: phrase,
              keyword: kw
            });
          }
        });
      });
      if (talkingPoints.length >= 8) return;
    });

    talkingPoints = talkingPoints.slice(0, 8);
  }

  /* ---- SEO headline generation ---- */
  function generateHeadlines(topic) {
    if (!topic) return [];
    var results = [];
    var templates = HEADLINE_TEMPLATES.slice();
    /* Shuffle */
    for (var i = templates.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = templates[i]; templates[i] = templates[j]; templates[j] = temp;
    }

    /* Extract a "subject" from the topic's examples */
    var subjectWords = [];
    if (topic.examples && topic.examples.length > 0) {
      var example = topic.examples[0].toLowerCase();
      THEMES[topic.theme].forEach(function(kw) {
        if (example.indexOf(kw) !== -1 && subjectWords.length < 3) {
          var words = kw.split(' ');
          words.forEach(function(w) { if (w.length > 3 && subjectWords.indexOf(w) === -1) subjectWords.push(w); });
        }
      });
    }
    if (subjectWords.length === 0) subjectWords = ['Global Developments', 'Key Players', 'Market Forces'];

    templates.slice(0, 6).forEach(function(tmpl) {
      var subj = subjectWords[Math.floor(Math.random() * subjectWords.length)];
      subj = subj.charAt(0).toUpperCase() + subj.slice(1);
      var headline = tmpl.replace('{subject}', subj).replace('{theme}', topic.theme);
      results.push(headline);
    });

    return results;
  }

  /* ---- Rendering ---- */
  function renderTrending() {
    var el = document.getElementById('waTrendingList');
    if (!el) return;
    if (trendingTopics.length === 0) {
      el.innerHTML = '<p class="wa-empty">No trending topics detected yet</p>';
      return;
    }
    var html = '';
    trendingTopics.forEach(function(topic, idx) {
      html += '<div class="wa-topic-item wa-topic-' + topic.heat + '" data-theme="' + topic.theme + '">';
      html += '<div class="wa-topic-rank">#' + (idx + 1) + '</div>';
      html += '<div class="wa-topic-body">';
      html += '<div class="wa-topic-name">' + topic.theme + '</div>';
      html += '<div class="wa-topic-meta">' + topic.score + ' mention' + (topic.score !== 1 ? 's' : '') + ' across ' + headlines.length + ' headlines</div>';
      html += '</div>';
      html += '<div class="wa-topic-heat">';
      if (topic.heat === 'hot') html += '<span class="wa-heat-badge wa-heat-hot">HOT</span>';
      else if (topic.heat === 'warm') html += '<span class="wa-heat-badge wa-heat-warm">WARM</span>';
      else html += '<span class="wa-heat-badge wa-heat-cool">NEW</span>';
      html += '</div>';
      html += '</div>';
    });
    el.innerHTML = html;

    /* Attach click handlers for headline generation */
    el.querySelectorAll('.wa-topic-item').forEach(function(item) {
      item.style.cursor = 'pointer';
      item.addEventListener('click', function() {
        var themeName = this.getAttribute('data-theme');
        var topic = trendingTopics.find(function(t) { return t.theme === themeName; });
        if (topic) {
          currentTopic = topic;
          renderHeadlines(topic);
          switchTab('headlines');
        }
      });
    });
  }

  function renderHeadlines(topic) {
    var el = document.getElementById('waHeadlineList');
    if (!el) return;
    var hls = generateHeadlines(topic);
    if (hls.length === 0) {
      el.innerHTML = '<p class="wa-empty">Could not generate headlines</p>';
      return;
    }
    var html = '<div class="wa-headline-context">SEO headlines for: <strong>' + topic.theme + '</strong></div>';
    hls.forEach(function(hl, idx) {
      html += '<div class="wa-headline-item">';
      html += '<span class="wa-headline-num">' + (idx + 1) + '</span>';
      html += '<span class="wa-headline-text">' + hl + '</span>';
      html += '<button class="wa-copy-btn" data-text="' + hl.replace(/"/g, '&quot;') + '" title="Copy">';
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      html += '</button>';
      html += '</div>';
    });
    el.innerHTML = html;

    el.querySelectorAll('.wa-copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var text = this.getAttribute('data-text');
        navigator.clipboard.writeText(text).then(function() {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
          setTimeout(function() {
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          }, 2000);
        });
      });
    });
  }

  function renderTalkingPoints() {
    var el = document.getElementById('waTalkingList');
    if (!el) return;
    if (talkingPoints.length === 0) {
      el.innerHTML = '<p class="wa-empty">No talking points extracted</p>';
      return;
    }
    var html = '';
    talkingPoints.forEach(function(tp, idx) {
      html += '<div class="wa-talk-item">';
      html += '<div class="wa-talk-header">';
      html += '<span class="wa-talk-num">' + (idx + 1) + '</span>';
      html += '<span class="wa-talk-theme">' + tp.theme + '</span>';
      html += '</div>';
      html += '<div class="wa-talk-point">' + tp.point + '</div>';
      html += '</div>';
    });
    el.innerHTML = html;
  }

  /* ---- Tab switching ---- */
  function switchTab(tabName) {
    var tabs = document.querySelectorAll('.wa-tab');
    var contents = document.querySelectorAll('.wa-tab-content');
    tabs.forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });
    contents.forEach(function(c) {
      c.classList.toggle('active', c.id === 'wa' + tabName.charAt(0).toUpperCase() + tabName.slice(1) + 'Tab');
    });
  }

  /* ---- Runner ---- */
  function run() {
    var widget = document.getElementById('writingAssistantWidget');
    if (!widget) return;

    fetchAll().then(function() {
      if (headlines.length === 0) return;
      detectTrends();
      extractTalkingPoints();
      renderTrending();
      renderTalkingPoints();
      var now = new Date();
      var ts = document.getElementById('waTimestamp');
      if (ts) ts.textContent = 'Scanned ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }).catch(function() {});
  }

  function setupUI() {
    var tabs = document.querySelectorAll('.wa-tab');
    tabs.forEach(function(t) {
      t.addEventListener('click', function() {
        switchTab(this.getAttribute('data-tab'));
      });
    });
    var btn = document.getElementById('waRefreshBtn');
    if (btn) btn.addEventListener('click', run);
  }

  function init() {
    if (!document.getElementById('writingAssistantWidget')) return;
    setupUI();
    run();
    setInterval(run, 300000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
