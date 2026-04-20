/* ================================================================
   Pro Analysis Widget - Enhanced Rule-Based Market Intelligence
   Per-source sentiment, trend detection, regime indicator, briefing
   ================================================================ */
(function() {
  'use strict';

  var RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
  var FEEDS = [
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', name: 'NYT Business', short: 'NYT' },
    { url: 'http://feeds.bbci.co.uk/news/business/rss.xml', name: 'BBC Business', short: 'BBC' },
    { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', name: 'CNBC', short: 'CNBC' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera', short: 'AJ' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NYT World', short: 'NYT' },
    { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World', short: 'BBC' }
  ];

  var PAIRS = {
    'usdngn': { name: 'USD/NGN', base: 'usd', quote: 'ngn', inv: true },
    'eurusd': { name: 'EUR/USD', base: 'eur', quote: 'usd' },
    'gbpusd': { name: 'GBP/USD', base: 'gbp', quote: 'usd' },
    'xauusd': { name: 'XAU/USD', base: 'xau', quote: 'usd' }
  };

  var BEARISH = {
    'usd': ['dollar weak','dollar falls','dollar drops','usd decline','dollar slump','fed dovish','rate cut','rate cuts','easing','stimulus','money supply','quantitative easing','print money'],
    'ngn': ['debt','inflation','naira falls','naira weak','fx crisis','forex crisis','cbn','central bank nigeria','recession','budget deficit','fiscal deficit','unemployment','economic crisis','devaluation'],
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

  var RISK_UP = ['war','conflict','crisis','crash','recession','depression','default','sanction','terror','pandemic','debt record','inflation surge','hack','breach','earthquake','hurricane'];
  var RISK_DOWN = ['peace','deal','agreement','recovery','growth','surplus','record high market','boom','rally','breakthrough','vaccine','stimulus approved'];

  /* ---- State ---- */
  var feedItems = [];      // { source, title, sentiment }
  var pairSignals = {};
  var sourceSentiment = {};
  var riskScore = 50;
  var prevSignals = null;
  var prevRisk = null;
  var signalsHistory = [];

  /* ---- RSS fetching with source tracking ---- */
  function fetchFeed(feed) {
    return fetch(RSS2JSON + encodeURIComponent(feed.url))
      .then(function(r) { if (!r.ok) return null; return r.json(); })
      .then(function(data) {
        if (!data || data.status !== 'ok' || !data.items) return [];
        return data.items.map(function(i) {
          return { source: feed.short, fullName: feed.name, title: i.title };
        });
      })
      .catch(function() { return []; });
  }

  function fetchAll() {
    return Promise.all(FEEDS.map(fetchFeed)).then(function(results) {
      feedItems = [];
      results.forEach(function(arr) { feedItems = feedItems.concat(arr); });
      return feedItems;
    });
  }

  /* ---- Deep analysis ---- */
  function analyze() {
    pairSignals = {};
    Object.keys(PAIRS).forEach(function(key) { pairSignals[key] = { bullish: 0, bearish: 0, reasons: [], sourceSignals: {} }; });
    sourceSentiment = {};
    riskScore = 50;

    feedItems.forEach(function(item) {
      var h = item.title.toLowerCase();
      var src = item.source;
      var itemBull = 0;
      var itemBear = 0;

      /* Risk */
      RISK_UP.forEach(function(kw) { if (h.indexOf(kw) !== -1) riskScore = Math.min(100, riskScore + 8); });
      RISK_DOWN.forEach(function(kw) { if (h.indexOf(kw) !== -1) riskScore = Math.max(0, riskScore - 5); });

      /* Per-pair signals */
      Object.keys(PAIRS).forEach(function(key) {
        var pair = PAIRS[key];
        [BEARISH, BULLISH].forEach(function(dict, di) {
          var dirs = [pair.base, pair.quote];
          dirs.forEach(function(currency) {
            (dict[currency] || []).forEach(function(kw) {
              if (h.indexOf(kw) !== -1) {
                var isBull = di === 1;
                var effective = isBull;
                if ((di === 0 && !pair.inv) || (di === 1 && pair.inv)) effective = false; // bearish
                if ((di === 0 && pair.inv) || (di === 1 && !pair.inv)) effective = true;  // bullish
                var dir = effective ? 'bullish' : 'bearish';
                pairSignals[key][dir]++;
                pairSignals[key].reasons.push({ text: item.title, dir: dir, source: src });
                if (!pairSignals[key].sourceSignals[src]) pairSignals[key].sourceSignals[src] = { bullish: 0, bearish: 0 };
                pairSignals[key].sourceSignals[src][dir]++;
                if (effective) itemBull++; else itemBear++;
              }
            });
          });
        });
      });

      /* Per-source sentiment tracking */
      if (!sourceSentiment[src]) sourceSentiment[src] = { bull: 0, bear: 0, total: 0, name: item.fullName };
      sourceSentiment[src].total++;
      sourceSentiment[src].bull += itemBull;
      sourceSentiment[src].bear += itemBear;
    });

    /* Trend detection: compare with previous scan */
    var currentSnapshot = {};
    Object.keys(pairSignals).forEach(function(key) {
      currentSnapshot[key] = { sig: getSignal(key), bull: pairSignals[key].bullish, bear: pairSignals[key].bearish };
    });

    if (prevSignals) {
      /* Save trend changes */
      signalsHistory = [];
      Object.keys(PAIRS).forEach(function(key) {
        var curr = currentSnapshot[key];
        var prev = prevSignals[key];
        if (!prev) return;
        if (curr.sig !== prev.sig) {
          signalsHistory.push({
            pair: PAIRS[key].name,
            from: prev.sig, to: curr.sig,
            change: curr.sig === 'bullish' ? 'upgraded' : 'downgraded'
          });
        }
      });
      /* Risk trend */
      var riskDiff = riskScore - (prevRisk || 50);
      if (Math.abs(riskDiff) > 10) {
        signalsHistory.push({
          pair: 'Risk Pulse',
          from: (prevRisk || 50).toString(),
          to: riskScore.toString(),
          change: riskDiff > 0 ? 'rising' : 'falling',
          isRisk: true,
          diff: riskDiff
        });
      }
    }

    prevSignals = currentSnapshot;
    prevRisk = riskScore;
  }

  /* ---- Helpers ---- */
  function getSignal(pair) {
    var s = pairSignals[pair];
    if (!s) return 'neutral';
    if (s.bullish > s.bearish && s.bullish > 0) return 'bullish';
    if (s.bearish > s.bullish && s.bearish > 0) return 'bearish';
    if (s.bullish > 0 || s.bearish > 0) return s.bullish >= s.bearish ? 'bullish' : 'bearish';
    return 'neutral';
  }

  function getRegime(score, signalCount) {
    var svgUp = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
    var svgDown = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    var svgFlat = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    if (score >= 75 && signalCount >= 6) return { text: 'Risk-On', class: 'pro-regime-riskon', icon: svgUp };
    if (score >= 60) return { text: 'Optimistic', class: 'pro-regime-optimistic', icon: svgUp };
    if (score >= 40) return { text: 'Cautious', class: 'pro-regime-cautious', icon: svgFlat };
    if (score >= 25) return { text: 'Risk-Off', class: 'pro-regime-riskoff', icon: svgDown };
    return { text: 'Panic Mode', class: 'pro-regime-panic', icon: svgDown };
  }

  function getSignalStrength() {
    var total = 0;
    var max = Object.keys(PAIRS).length * 4;
    Object.keys(pairSignals).forEach(function(key) {
      var s = pairSignals[key];
      total += Math.max(s.bullish, s.bearish);
    });
    return Math.min(100, Math.round((total / max) * 100));
  }

  function generateBriefing() {
    var regime = getRegime(riskScore, getSignalStrength());
    var parts = [];

    /* Opening */
    if (regime.text === 'Risk-On' || regime.text === 'Optimistic') {
      var opens = ['Markets show bullish momentum as', 'Positive sentiment dominates with', 'Risk appetite strengthens as'];
      parts.push(opens[Math.floor(Math.random() * opens.length)]);
    } else if (regime.text === 'Cautious') {
      var cauts = ['Markets remain cautious amid', 'Mixed signals persist as', 'Investors adopt wait-and-see stance as'];
      parts.push(cauts[Math.floor(Math.random() * cauts.length)]);
    } else {
      var bears = ['Risk aversion intensifies as', 'Bearish signals mount with', 'Defensive positioning dominates as'];
      parts.push(bears[Math.floor(Math.random() * bears.length)]);
    }

    /* Top pair */
    var topPair = null;
    var topStrength = 0;
    Object.keys(pairSignals).forEach(function(key) {
      var s = pairSignals[key];
      var str = Math.abs(s.bullish - s.bearish);
      if (str > topStrength) { topStrength = str; topPair = { key: key, sig: getSignal(key) }; }
    });
    if (topPair) {
      var pairName = PAIRS[topPair.key].name;
      if (topPair.sig === 'bullish') parts.push(pairName + ' leads bullish momentum.');
      else if (topPair.sig === 'bearish') parts.push(pairName + ' faces persistent selling pressure.');
      else parts.push(pairName + ' shows no clear directional bias.');
    }

    /* Key drivers */
    var driverCount = 0;
    Object.keys(sourceSentiment).forEach(function(src) {
      var s = sourceSentiment[src];
      if (s.bear > s.bull + 1) { parts.push(s.name + ' headlines skew bearish.'); driverCount++; }
      else if (s.bull > s.bear + 1) { parts.push(s.name + ' reports positive developments.'); driverCount++; }
    });

    /* Risk context */
    if (riskScore > 65) parts.push('Risk appetite remains elevated with strong momentum across indices.');
    else if (riskScore < 35) parts.push('Elevated caution warranted as downside risks dominate the narrative.');

    /* Trend alerts */
    if (signalsHistory.length > 0) {
      var trendPairs = signalsHistory.filter(function(t) { return !t.isRisk; });
      if (trendPairs.length > 0) {
        parts.push('Signal shift detected: ' + trendPairs.map(function(t) { return t.pair + ' ' + t.change; }).join(', ') + '.');
      }
    }

    return parts.join(' ');
  }

  /* ---- Rendering ---- */
  function render() {
    var el = document.getElementById('proAnalysisWidget');
    if (!el) return;
    var loading = el.querySelector('.pro-loading-sm');
    if (loading) loading.style.display = 'none';

    /* Regime */
    var signalCount = getSignalStrength();
    var regime = getRegime(riskScore, signalCount);
    var regimeEl = document.getElementById('proRegimeValue');
    if (regimeEl) {
      regimeEl.className = 'pro-regime-value ' + regime.class;
      regimeEl.innerHTML = '<span class="pro-regime-dot"></span><span class="pro-regime-text">' + regime.icon + ' ' + regime.text + '</span>';
    }

    /* Signal Strength */
    var strength = getSignalStrength();
    document.getElementById('proStrengthValue').textContent = strength + '%';
    var fill = document.getElementById('proStrengthFill');
    fill.style.width = strength + '%';
    fill.className = 'pro-strength-fill';
    if (strength >= 75) fill.classList.add('pro-str-very-strong');
    else if (strength >= 50) fill.classList.add('pro-str-strong');
    else if (strength >= 25) fill.classList.add('pro-str-moderate');
    else fill.classList.add('pro-str-weak');

    /* Source Sentiment */
    var srcHtml = '';
    Object.keys(sourceSentiment).forEach(function(src) {
      var s = sourceSentiment[src];
      if (s.total === 0) return;
      var bullPct = s.total > 0 ? Math.round((s.bull / s.total) * 100) : 50;
      var bearPct = 100 - bullPct;
      var bias = bullPct > 55 ? 'bullish' : (bearPct > 55 ? 'bearish' : 'neutral');
      srcHtml += '<div class="pro-src-row">';
      srcHtml += '<span class="pro-src-name">' + src + '</span>';
      srcHtml += '<div class="pro-src-bar">';
      srcHtml += '<div class="pro-src-bull" style="width:' + bullPct + '%"></div>';
      srcHtml += '</div>';
      srcHtml += '<span class="pro-src-pct pro-src-bull-pct">' + bullPct + '%</span>';
      srcHtml += '<span class="pro-src-bias pro-bias-' + bias + '">' + bias.charAt(0).toUpperCase() + bias.slice(1) + '</span>';
      srcHtml += '</div>';
    });
    if (!srcHtml) srcHtml = '<div class="pro-loading-sm">No source data</div>';
    document.getElementById('proSourceBreakdown').innerHTML = srcHtml;

    /* Trend Changes */
    var trendHtml = '';
    if (signalsHistory.length === 0) {
      trendHtml = '<div class="pro-trend-none">No signal changes since last scan</div>';
    } else {
      signalsHistory.forEach(function(t) {
        trendHtml += '<div class="pro-trend-item">';
        if (t.isRisk) {
          trendHtml += '<span class="pro-trend-pair">' + t.pair + '</span>';
          trendHtml += '<span class="pro-trend-dir ' + (t.diff > 0 ? 'pro-up' : 'pro-down') + '">' + (t.diff > 0 ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><polyline points="18 15 12 9 6 15"/></svg> +' : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><polyline points="6 9 12 15 18 9"/></svg> ') + Math.abs(t.diff) + ' pts</span>';
        } else {
          trendHtml += '<span class="pro-trend-pair">' + t.pair + '</span>';
          trendHtml += '<span class="pro-trend-from pro-bias-' + t.from + '">' + t.from + '</span>';
          trendHtml += '<span class="pro-trend-arrow">&#8594;</span>';
          trendHtml += '<span class="pro-trend-to pro-bias-' + t.to + '">' + t.to + '</span>';
        }
        trendHtml += '</div>';
      });
    }
    document.getElementById('proTrendChanges').innerHTML = trendHtml;

    /* Briefing */
    document.getElementById('proBriefingBody').innerHTML = '<p>' + generateBriefing() + '</p>';

    /* Timestamp */
    var now = new Date();
    document.getElementById('proTimestamp').textContent = 'Pro analysis ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /* ---- Runner ---- */
  function run() {
    var widget = document.getElementById('proAnalysisWidget');
    if (!widget) return;

    fetchAll().then(function() {
      if (feedItems.length === 0) return;
      analyze();
      render();
    }).catch(function() {});
  }

  function setupUI() {
    var btn = document.getElementById('proRefreshBtn');
    if (btn) btn.addEventListener('click', run);
  }

  function init() {
    if (!document.getElementById('proAnalysisWidget')) return;
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
