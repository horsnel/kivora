/* ================================================================
   AI Market Intelligence Widget - Free Tier Only
   Rule-based keyword analysis engine on RSS headlines
   ================================================================ */
(function() {
  'use strict';

  /* ---- Configuration ---- */
  var RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
  var FEEDS = [
    'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
    'http://feeds.bbci.co.uk/news/business/rss.xml',
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'http://feeds.bbci.co.uk/news/world/rss.xml'
  ];

  /* ---- Keyword dictionaries ---- */
  var BEARISH = {
    'usd': ['dollar weak','dollar falls','dollar drops','usd decline','dollar slump','fed dovish','rate cut','rate cuts','easing','stimulus','money supply','quantitative easing','print money'],
    'ngn': ['debt','inflation','naira falls','naira weak','fx crisis','forex crisis','cbn','central bank nigeria','recession','budget deficit','fiscal deficit','unemployment','economic crisis',' austerity','devaluation'],
    'eur': ['ecb dovish','euro weak','eurozone recession','eu slowdown','german contraction','italian crisis','euro falls','euro drops','eu inflation drop','stagflation'],
    'gbp': ['bank of england dovish','uk recession','uk contraction','british economy weak','sterling falls','gdp miss','uk unemployment','boe dovish','uk slowdown'],
    'xau': ['gold rises','gold rally','gold surge','safe haven','geopolitical tension','war','conflict','inflation hedge','market crash','risk off','uncertainty','crisis']
  };

  var BULLISH = {
    'usd': ['dollar strong','dollar rally','dollar gains','fed hawkish','rate hike','rate hikes','tightening','strong jobs','strong economy','us growth','us gdp beat'],
    'ngn': ['foreign investment','fdi','oil revenue','trade surplus','economic reform','growth forecast','naira gains','reserves','imf praise','credit upgrade','diversification'],
    'eur': ['ecb hawkish','euro strong','eu growth','german expansion','manufacturing beat','eurozone recovery','euro rises','eu inflation'],
    'gbp': ['boe hawkish','uk gdp beat','uk growth','uk jobs strong','sterling rally','british economy','wage growth','uk expansion'],
    'xau': ['gold drops','gold falls','risk on','market rally','equities high','strong dollar','peace talks','resolution']
  };

  var PAIRS = {
    'usdngn': { name: 'USD/NGN', base: 'usd', quote: 'ngn', inv: true },
    'eurusd': { name: 'EUR/USD', base: 'eur', quote: 'usd' },
    'gbpusd': { name: 'GBP/USD', base: 'gbp', quote: 'usd' },
    'xauusd': { name: 'XAU/USD', base: 'xau', quote: 'usd' }
  };

  var EVENT_KEYWORDS = [
    { kw: ['fomc','federal reserve','fed meeting','fed rate','fed decision'], label: 'US FOMC Rate Decision' },
    { kw: ['opec','oil production','oil output','opec+'], label: 'OPEC+ Meeting' },
    { kw: ['ecb meeting','ecb rate','european central bank'], label: 'ECB Rate Decision' },
    { kw: ['bank of england','boe rate','boe meeting'], label: 'BOE Rate Decision' },
    { kw: ['cbn','central bank of nigeria','nigeria rate'], label: 'Nigeria CBN Policy' },
    { kw: ['gdp','gross domestic product'], label: 'GDP Release' },
    { kw: ['election','vote','referendum','poll'], label: 'Major Election' },
    { kw: ['nonfarm payrolls','jobs report','employment'], label: 'US Jobs Report' },
    { kw: ['cpi','inflation data','consumer price'], label: 'CPI Inflation Data' },
    { kw: ['trade talks','tariff','trade deal','sanction'], label: 'Trade Policy Event' }
  ];

  var RISK_UP = ['war','conflict','crisis','crash','recession','depression','default','sanction','terror','pandemic','debt record','inflation surge','hack','breach','earthquake','hurricane'];
  var RISK_DOWN = ['peace','deal','agreement','recovery','growth','surplus','record high market','boom','rally','breakthrough','vaccine','stimulus approved'];

  /* ---- State ---- */
  var headlines = [];
  var pairSignals = {};
  var riskScore = 50;
  var drivers = [];
  var watchEvents = [];

  /* ---- RSS fetching ---- */
  function fetchFeed(url) {
    return fetch(RSS2JSON + encodeURIComponent(url))
      .then(function(r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function(data) {
        if (!data || data.status !== 'ok' || !data.items) return [];
        return data.items.map(function(i) { return i.title; });
      })
      .catch(function() { return []; });
  }

  function fetchAllHeadlines() {
    return Promise.all(FEEDS.map(fetchFeed)).then(function(results) {
      headlines = [];
      results.forEach(function(arr) { headlines = headlines.concat(arr); });
      return headlines;
    });
  }

  /* ---- Analysis engine ---- */
  function analyzeHeadlines() {
    pairSignals = {};
    Object.keys(PAIRS).forEach(function(key) { pairSignals[key] = { bullish: 0, bearish: 0, reasons: [] }; });
    riskScore = 50;
    drivers = [];
    watchEvents = [];

    headlines.forEach(function(headline) {
      var h = headline.toLowerCase();

      RISK_UP.forEach(function(kw) { if (h.indexOf(kw) !== -1) riskScore = Math.min(100, riskScore + 8); });
      RISK_DOWN.forEach(function(kw) { if (h.indexOf(kw) !== -1) riskScore = Math.max(0, riskScore - 5); });

      Object.keys(PAIRS).forEach(function(key) {
        var pair = PAIRS[key];
        BEARISH[pair.base].forEach(function(kw) {
          if (h.indexOf(kw) !== -1) {
            var effective = pair.inv ? 'bullish' : 'bearish';
            pairSignals[key][effective]++;
            pairSignals[key].reasons.push({ text: headline, dir: effective });
          }
        });
        BEARISH[pair.quote].forEach(function(kw) {
          if (h.indexOf(kw) !== -1) {
            var effective2 = pair.inv ? 'bearish' : 'bullish';
            pairSignals[key][effective2]++;
            pairSignals[key].reasons.push({ text: headline, dir: effective2 });
          }
        });
        BULLISH[pair.base].forEach(function(kw) {
          if (h.indexOf(kw) !== -1) {
            var effective3 = pair.inv ? 'bearish' : 'bullish';
            pairSignals[key][effective3]++;
            pairSignals[key].reasons.push({ text: headline, dir: effective3 });
          }
        });
        BULLISH[pair.quote].forEach(function(kw) {
          if (h.indexOf(kw) !== -1) {
            var effective4 = pair.inv ? 'bullish' : 'bearish';
            pairSignals[key][effective4]++;
            pairSignals[key].reasons.push({ text: headline, dir: effective4 });
          }
        });
      });

      EVENT_KEYWORDS.forEach(function(evt) {
        evt.kw.forEach(function(kw) {
          if (h.indexOf(kw) !== -1 && watchEvents.indexOf(evt.label) === -1) {
            watchEvents.push(evt.label);
          }
        });
      });
    });

    var allReasons = [];
    Object.keys(pairSignals).forEach(function(key) {
      pairSignals[key].reasons.forEach(function(r) { allReasons.push(r.text); });
    });
    var seen = {};
    drivers = [];
    allReasons.forEach(function(d) {
      var k = d.toLowerCase().trim();
      if (!seen[k] && drivers.length < 5) { seen[k] = true; drivers.push(d); }
    });
  }

  /* ---- Rendering ---- */
  function getSignal(pair) {
    var s = pairSignals[pair];
    if (s.bullish > s.bearish && s.bullish > 0) return 'bullish';
    if (s.bearish > s.bullish && s.bearish > 0) return 'bearish';
    if (s.bullish > 0 || s.bearish > 0) return s.bullish >= s.bearish ? 'bullish' : 'bearish';
    return 'neutral';
  }

  function getSignalIcon(sig) {
    if (sig === 'bullish') return '<span class="ai-sig-icon ai-bull"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></span>';
    if (sig === 'bearish') return '<span class="ai-sig-icon ai-bear"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>';
    return '<span class="ai-sig-icon ai-neut"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></span>';
  }

  function getRiskLabel(score) {
    if (score >= 70) return 'Risk-On';
    if (score >= 40) return 'Neutral';
    return 'Risk-Off';
  }

  function renderFree() {
    var el = document.getElementById('aiFreeResults');
    var loading = el ? el.parentElement.querySelector('.ai-loading') : null;
    if (!el) return;
    if (loading) loading.style.display = 'none';
    el.style.display = 'block';

    document.getElementById('aiRiskScore').textContent = riskScore + '/100';
    document.getElementById('aiRiskFill').style.width = riskScore + '%';
    var fill = document.getElementById('aiRiskFill');
    fill.className = 'ai-risk-fill';
    if (riskScore >= 70) fill.classList.add('ai-risk-high');
    else if (riskScore >= 40) fill.classList.add('ai-risk-mid');
    else fill.classList.add('ai-risk-low');
    document.getElementById('aiRiskText').textContent = getRiskLabel(riskScore);

    var pairsHtml = '';
    Object.keys(PAIRS).forEach(function(key) {
      var pair = PAIRS[key];
      var sig = getSignal(key);
      var s = pairSignals[key];
      var hits = s.bullish + s.bearish;
      pairsHtml += '<div class="ai-pair">';
      pairsHtml += '<span class="ai-pair-name">' + pair.name + '</span>';
      pairsHtml += getSignalIcon(sig);
      pairsHtml += '<span class="ai-pair-sig ai-' + sig + '">' + sig.charAt(0).toUpperCase() + sig.slice(1) + '</span>';
      if (hits > 0) pairsHtml += '<span class="ai-pair-hits">' + hits + ' hit' + (hits > 1 ? 's' : '') + '</span>';
      pairsHtml += '</div>';
    });
    document.getElementById('aiForexPairs').innerHTML = pairsHtml;

    var drvHtml = '';
    drivers.forEach(function(d) { drvHtml += '<li>' + d + '</li>'; });
    if (drivers.length === 0) drvHtml = '<li>Scanning for drivers...</li>';
    document.getElementById('aiDrivers').innerHTML = drvHtml;

    var evtHtml = '';
    watchEvents.forEach(function(e) { evtHtml += '<li>&#8226; ' + e + '</li>'; });
    if (watchEvents.length === 0) evtHtml = '<li>No upcoming events detected</li>';
    document.getElementById('aiWatchlist').innerHTML = evtHtml;

    var now = new Date();
    document.getElementById('aiTimestamp').textContent = 'Analyzed ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /* ---- Runner ---- */
  function runFree() {
    var widget = document.getElementById('aiAnalysisWidget');
    if (!widget) return;
    var loading = widget.querySelector('.ai-loading');
    if (loading) loading.style.display = 'block';
    var results = document.getElementById('aiFreeResults');
    if (results) results.style.display = 'none';

    fetchAllHeadlines().then(function() {
      if (headlines.length === 0) {
        if (loading) loading.textContent = 'No headlines available';
        return;
      }
      analyzeHeadlines();
      renderFree();
    }).catch(function() {
      if (loading) loading.textContent = 'Analysis unavailable';
    });
  }

  /* ---- UI event handlers ---- */
  function setupUI() {
    var refreshBtn = document.getElementById('aiRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', function() { runFree(); });
  }

  /* ---- Init ---- */
  function init() {
    if (!document.getElementById('aiAnalysisWidget')) return;
    setupUI();
    runFree();
    setInterval(runFree, 300000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
