(function() {
  var r = document.getElementById("search-toggle");
  var t = document.getElementById("search-overlay");
  var s = document.getElementById("search-input");
  var c = document.getElementById("search-close");
  var n = document.getElementById("search-results");
  var sm = null, sa = null, su = null;

  function openSearch() {
    if (t) {
      t.classList.add("active");
      document.body.style.overflow = "hidden";
      if (s) s.focus();
    }
  }
  function closeSearch() {
    if (t) {
      t.classList.remove("active");
      document.body.style.overflow = "";
      if (s) s.value = "";
      if (n) n.innerHTML = "";
    }
  }

  if (r) r.addEventListener("click", openSearch);
  if (c) c.addEventListener("click", closeSearch);
  if (t) t.addEventListener("click", function(e) { if (e.target === t) closeSearch(); });
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeSearch();
    if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); openSearch(); }
  });

  if (s && n) {
    fetch("/index.json").then(function(e) { return e.json(); }).then(function(data) {
      sm = data;
      sa = new Fuse(data, {
        keys: ["title", "summary", "categories", "tags"],
        threshold: 0.35,
        ignoreLocation: true,
        includeScore: true
      });
    }).catch(function() {});

    s.addEventListener("input", function() {
      clearTimeout(su);
      var q = s.value.trim();
      if (!q) { n.innerHTML = ""; return; }
      su = setTimeout(function() {
        if (!sa) {
          n.innerHTML = '<p style="color:#888;padding:20px;">Loading search index...</p>';
          return;
        }
        var results = sa.search(q);
        if (!results.length) {
          n.innerHTML = '<p style="color:#888;padding:20px;">No results found for "' + q + '".</p>';
          return;
        }
        var html = '';
        var max = Math.min(results.length, 10);
        for (var i = 0; i < max; i++) {
          var item = results[i].item;
          var cat = (item.categories && item.categories.length) ? item.categories[0] : "";
          var dateStr = item.date ? new Date(item.date).toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"}) : "";
          html += '<a class="search-result-item" href="' + item.permalink + '">';
          if (item.image) html += '<img src="' + item.image + '" alt="" />';
          html += '<div class="search-result-body">';
          if (cat) html += '<span class="search-result-cat">' + cat + '</span>';
          html += '<h3>' + item.title + '</h3>';
          if (item.summary) html += '<p>' + item.summary.substring(0, 140) + '...</p>';
          if (dateStr) html += '<span class="search-result-date">' + dateStr + '</span>';
          html += '</div></a>';
        }
        n.innerHTML = html;
      }, 250);
    });
  }
})();
