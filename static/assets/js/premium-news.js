/* === Premium News Widget — RSS2JSON proxy (bypasses IP bans) === */
(function() {
  var feeds = [
    { name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
    { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
    { name: 'BBC Business', url: 'http://feeds.bbci.co.uk/news/business/rss.xml' }
  ];

  var proxyUrl = 'https://api.rss2json.com/v1/api.json?rss_url=';
  var seenTitles = {};
  var allItems = [];

  function fetchFeed(feed) {
    return fetch(proxyUrl + encodeURIComponent(feed.url))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status !== 'ok' || !data.items) return [];
        return data.items.slice(0, 5).map(function(item) {
          return {
            title: item.title,
            link: item.link,
            source: feed.name,
            pubDate: item.pubDate ? new Date(item.pubDate) : null,
            thumbnail: item.thumbnail || item.enclosure ? (item.enclosure && item.enclosure.link ? item.enclosure.link : item.thumbnail) : null
          };
        });
      })
      .catch(function() { return []; });
  }

  function timeAgo(date) {
    if (!date) return '';
    var seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  function renderItems(items) {
    var feed = document.getElementById('premiumFeed');
    var loading = feed ? feed.parentElement.querySelector('.premium-loading') : null;
    if (!feed) return;

    var unique = [];
    items.forEach(function(item) {
      var key = item.title.toLowerCase().trim();
      if (!seenTitles[key] && unique.length < 12) {
        seenTitles[key] = true;
        unique.push(item);
      }
    });

    if (unique.length === 0) {
      if (loading) loading.textContent = 'Unable to load feed';
      return;
    }

    if (loading) loading.style.display = 'none';
    feed.style.display = 'block';

    var html = '';
    unique.forEach(function(item) {
      html += '<a class="premium-item" href="' + item.link + '" target="_blank" rel="noopener">';
      if (item.thumbnail) {
        html += '<img src="' + item.thumbnail + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">';
      }
      html += '<div class="premium-item-body">';
      html += '<span class="premium-item-source">' + item.source + '</span>';
      html += '<h4>' + item.title + '</h4>';
      if (item.pubDate) html += '<span class="premium-item-time">' + timeAgo(item.pubDate) + '</span>';
      html += '</div></a>';
    });
    feed.innerHTML = html;
  }

  function loadAll() {
    Promise.all(feeds.map(fetchFeed)).then(function(results) {
      var combined = [].concat.apply([], results);
      combined.sort(function(a, b) {
        if (!a.pubDate) return 1;
        if (!b.pubDate) return -1;
        return b.pubDate - a.pubDate;
      });
      renderItems(combined);
    });
  }

  if (document.getElementById('premiumNewsWidget')) {
    loadAll();
    setInterval(loadAll, 900000);
  }
})();
