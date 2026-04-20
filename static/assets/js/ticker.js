/* === Live News Ticker — Fetches real headlines from RSS via rss2json === */
(function() {
  'use strict';

  var FEEDS = [
    { name: 'NYT', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', color: '#000' },
    { name: 'BBC', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', color: '#BB1919' },
    { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', color: '#002f6c' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', color: '#D4A017' },
    { name: 'NYT', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', color: '#000' },
    { name: 'BBC', url: 'http://feeds.bbci.co.uk/news/business/rss.xml', color: '#BB1919' }
  ];

  var PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';
  var MAX_HEADLINES = 30;
  var REFRESH_INTERVAL = 300000; // 5 minutes
  var track = document.getElementById('tickerTrack');
  var bar = document.getElementById('breakingBar');
  var timeEl = document.getElementById('tickerTime');

  if (!track || !bar) return;

  /* Live clock */
  function updateClock() {
    if (!timeEl) return;
    var now = new Date();
    var h = now.getHours(), m = now.getMinutes();
    timeEl.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  updateClock();
  setInterval(updateClock, 30000);

  /* Fetch a single feed */
  function fetchFeed(feed) {
    return fetch(PROXY + encodeURIComponent(feed.url))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status !== 'ok' || !data.items) return [];
        return data.items.slice(0, 8).map(function(item) {
          return {
            title: item.title,
            link: item.link,
            source: feed.name,
            color: feed.color
          };
        });
      })
      .catch(function() { return []; });
  }

  /* Build HTML for one headline */
  function headlineHTML(item) {
    return '<a class="ticker-item" href="' + item.link + '" target="_blank" rel="noopener">'
      + '<span class="ticker-source" style="background:' + item.color + '">' + item.source + '</span>'
      + '<span class="ticker-text">' + item.title + '</span>'
      + '<span class="ticker-sep">\u00B7</span>'
      + '</a>';
  }

  /* Render headlines into the track */
  function render(allItems) {
    if (!allItems.length) return;

    // Sort by recency (pubDate is not available here, so keep feed order)
    var items = allItems.slice(0, MAX_HEADLINES);
    var html = items.map(headlineHTML).join('');

    // Duplicate for seamless loop
    track.innerHTML = html + html;

    // Start animation
    track.classList.add('ticker-animate');

    // Pause on hover
    bar.addEventListener('mouseenter', function() {
      track.style.animationPlayState = 'paused';
    });
    bar.addEventListener('mouseleave', function() {
      track.style.animationPlayState = 'running';
    });
  }

  /* Load all feeds */
  function loadHeadlines() {
    Promise.all(FEEDS.map(fetchFeed)).then(function(results) {
      var combined = [];
      results.forEach(function(items) {
        combined = combined.concat(items);
      });
      if (combined.length > 0) {
        render(combined);
      }
    }).catch(function() {
      // Silent fail — keep existing content or "Loading..." text
    });
  }

  /* Kick off */
  loadHeadlines();
  setInterval(loadHeadlines, REFRESH_INTERVAL);

})();
