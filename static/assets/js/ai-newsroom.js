/* ================================================================
   AI Newsroom - Article Generator & Library
   MenshlyGlobal AI Newsroom Client-Side Logic
   ================================================================ */
(function() {
  'use strict';

  var STORAGE_KEY = 'menshly_ai_articles';
  var API_ENDPOINT = '/api/generate-article';

  var TRENDING_TOPICS = [
    'Global fintech disruption and digital banking adoption in Africa',
    'AI regulation policies and their impact on tech companies in 2026',
    'Nigeria economic diversification: Beyond oil dependence',
    'Climate change investment strategies for emerging markets',
    'The future of remote work and its effect on commercial real estate',
    'Central bank digital currencies: CBDC rollout across Africa',
    'Space economy: Private sector growth and satellite internet expansion',
    'Global supply chain resilience after recent disruptions',
    'Electric vehicle market expansion in developing nations',
    'Cybersecurity threats to financial institutions in 2026',
    'The rise of African tech startups and venture capital flows',
    'Geopolitical tensions and their effect on global trade routes',
    'Healthcare innovation: AI-assisted diagnostics in Africa',
    'Renewable energy transition challenges in oil-dependent economies',
    'Social media regulation and free speech debates worldwide'
  ];

  /* ---- State ---- */
  var currentArticle = null;
  var savedArticles = [];

  /* ---- LocalStorage ---- */
  function loadArticles() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      savedArticles = data ? JSON.parse(data) : [];
    } catch (e) {
      savedArticles = [];
    }
  }

  function saveArticles() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedArticles));
    } catch (e) {}
    renderLibrary();
  }

  /* ---- UI References ---- */
  function getEl(id) { return document.getElementById(id); }

  /* ---- Status Display ---- */
  function showStatus(type, message) {
    var el = getEl('aiNewsroomStatus');
    if (!el) return;
    el.style.display = 'block';
    el.className = 'ai-newsroom-status ai-nr-status-' + type;
    var icon = '';
    if (type === 'loading') {
      icon = '<div class="ai-nr-spinner"></div>';
    } else if (type === 'success') {
      icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if (type === 'error') {
      icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    }
    el.innerHTML = icon + '<span>' + message + '</span>';
    if (type === 'loading') {
      el.style.display = 'block';
    } else {
      setTimeout(function() { el.style.display = 'none'; }, type === 'error' ? 8000 : 5000);
    }
  }

  function hideStatus() {
    var el = getEl('aiNewsroomStatus');
    if (el) el.style.display = 'none';
  }

  /* ---- Article Generation ---- */
  async function generateArticle() {
    var topicInput = getEl('aiTopicInput');
    var categorySelect = getEl('aiCategorySelect');
    var toneSelect = getEl('aiToneSelect');
    var lengthSelect = getEl('aiLengthSelect');
    var generateBtn = getEl('aiGenerateBtn');

    var topic = (topicInput.value || '').trim();
    if (!topic) {
      showStatus('error', 'Please enter a topic for the article.');
      topicInput.focus();
      return;
    }
    if (topic.length < 3) {
      showStatus('error', 'Topic must be at least 3 characters long.');
      topicInput.focus();
      return;
    }

    var category = categorySelect.value;
    var tone = toneSelect.value;
    var length = lengthSelect.value;

    /* Disable button, show loading */
    generateBtn.disabled = true;
    generateBtn.classList.add('ai-nr-generating');
    generateBtn.querySelector('span').textContent = 'Generating...';
    showStatus('loading', 'AI is crafting your article. This may take 10-30 seconds...');
    hideArticle();

    try {
      var response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic, category: category, tone: tone, length: length })
      });

      var data = await response.json();

      if (!response.ok || data.error) {
        var errMsg = data.error || 'Unknown error occurred';
        if (response.status === 503) {
          errMsg += ' To set up: Go to Cloudflare Dashboard > Pages > Settings > Environment Variables, then add AI_API_KEY.';
        }
        throw new Error(errMsg);
      }

      currentArticle = data;
      displayArticle(data);
      showStatus('success', 'Article generated successfully!');

    } catch (err) {
      showStatus('error', err.message || 'Failed to generate article. Please try again.');
    } finally {
      generateBtn.disabled = false;
      generateBtn.classList.remove('ai-nr-generating');
      generateBtn.querySelector('span').textContent = 'Generate Article';
    }
  }

  /* ---- Display Article ---- */
  function displayArticle(article) {
    var placeholder = getEl('aiNewsroomPlaceholder');
    var articleEl = getEl('aiNewsroomArticle');

    if (placeholder) placeholder.style.display = 'none';
    if (articleEl) {
      articleEl.style.display = 'block';
      articleEl.classList.add('ai-nr-article-enter');

      var catEl = getEl('aiNrArticleCat');
      var timeEl = getEl('aiNrArticleTime');
      var titleEl = getEl('aiNrArticleTitle');
      var summaryEl = getEl('aiNrArticleSummary');
      var readTimeEl = getEl('aiNrArticleReadTime');
      var bodyEl = getEl('aiNrArticleBody');

      if (catEl) catEl.textContent = article.category || 'General';
      if (timeEl) timeEl.textContent = formatDate(article.generatedAt);
      if (titleEl) titleEl.textContent = article.title || article.topic;
      if (summaryEl) summaryEl.textContent = article.summary || '';
      if (readTimeEl) readTimeEl.textContent = (article.readTime || 3) + ' min read';
      if (bodyEl) bodyEl.innerHTML = article.content || '<p>No content generated.</p>';
    }
  }

  function hideArticle() {
    var placeholder = getEl('aiNewsroomPlaceholder');
    var articleEl = getEl('aiNewsroomArticle');
    if (placeholder) placeholder.style.display = 'block';
    if (articleEl) {
      articleEl.style.display = 'none';
      articleEl.classList.remove('ai-nr-article-enter');
    }
  }

  /* ---- Library Management ---- */
  function saveArticle() {
    if (!currentArticle) return;

    /* Check if already saved */
    var exists = savedArticles.some(function(a) { return a.id === currentArticle.id; });
    if (exists) {
      showStatus('warning', 'This article is already in your library.');
      return;
    }

    savedArticles.unshift(currentArticle);
    if (savedArticles.length > 50) savedArticles = savedArticles.slice(0, 50);
    saveArticles();
    showStatus('success', 'Article saved to your library!');

    /* Update save button state */
    var saveBtn = getEl('aiNrSaveBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.querySelector('span').textContent = 'Saved';
    }
  }

  function deleteArticle(id) {
    savedArticles = savedArticles.filter(function(a) { return a.id !== id; });
    saveArticles();
    showStatus('success', 'Article removed from library.');
  }

  function viewArticle(id) {
    var article = savedArticles.find(function(a) { return a.id === id; });
    if (article) {
      currentArticle = article;
      displayArticle(article);
      window.scrollTo({ top: 300, behavior: 'smooth' });

      /* Update save button */
      var saveBtn = getEl('aiNrSaveBtn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.querySelector('span').textContent = 'Save';
      }
    }
  }

  function copyArticle() {
    if (!currentArticle) return;
    var text = '# ' + (currentArticle.title || '') + '\n\n';
    text += (currentArticle.summary || '') + '\n\n';
    text += (currentArticle.content || '').replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n');

    navigator.clipboard.writeText(text).then(function() {
      showStatus('success', 'Article copied to clipboard!');
    }).catch(function() {
      showStatus('error', 'Failed to copy. Try selecting the text manually.');
    });
  }

  function shareArticle() {
    if (!currentArticle) return;
    if (navigator.share) {
      navigator.share({
        title: currentArticle.title,
        text: currentArticle.summary,
        url: window.location.href
      }).catch(function() {});
    } else {
      copyArticle();
    }
  }

  /* ---- Library Rendering ---- */
  function renderLibrary() {
    var grid = getEl('aiLibraryGrid');
    var countEl = getEl('aiLibraryCount');
    var emptyEl = getEl('aiLibraryEmpty');

    if (!grid) return;
    if (countEl) countEl.textContent = savedArticles.length + ' article' + (savedArticles.length !== 1 ? 's' : '');

    if (savedArticles.length === 0) {
      grid.innerHTML = '';
      if (emptyEl) {
        emptyEl.style.display = 'block';
        grid.appendChild(emptyEl);
      } else {
        grid.innerHTML = '<div class="ai-newsroom-library-empty" id="aiLibraryEmpty">' +
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
          '<p>No saved articles yet</p>' +
          '<span>Generated articles you save will appear here</span></div>';
      }
      return;
    }

    var html = '';
    savedArticles.forEach(function(article) {
      html += '<div class="ai-library-card" data-id="' + article.id + '">';
      html += '<div class="ai-library-card-cat">' + (article.category || 'General') + '</div>';
      html += '<h4 class="ai-library-card-title">' + (article.title || article.topic) + '</h4>';
      html += '<p class="ai-library-card-summary">' + (article.summary || '').substring(0, 120) + '</p>';
      html += '<div class="ai-library-card-footer">';
      html += '<span class="ai-library-card-date">' + formatDate(article.generatedAt) + '</span>';
      html += '<span class="ai-library-card-read">' + (article.readTime || 3) + ' min read</span>';
      html += '</div>';
      html += '<div class="ai-library-card-actions">';
      html += '<button class="ai-lib-view-btn" data-id="' + article.id + '">Read</button>';
      html += '<button class="ai-lib-delete-btn" data-id="' + article.id + '">Delete</button>';
      html += '</div>';
      html += '</div>';
    });

    grid.innerHTML = html;

    /* Attach event listeners */
    grid.querySelectorAll('.ai-lib-view-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        viewArticle(this.getAttribute('data-id'));
      });
    });
    grid.querySelectorAll('.ai-lib-delete-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        deleteArticle(this.getAttribute('data-id'));
      });
    });
  }

  /* ---- Quick Topic Suggestion ---- */
  function suggestTopic() {
    var input = getEl('aiTopicInput');
    if (!input) return;
    var randomIndex = Math.floor(Math.random() * TRENDING_TOPICS.length);
    input.value = TRENDING_TOPICS[randomIndex];
    input.focus();

    /* Animate the input */
    input.style.borderColor = 'var(--accent)';
    input.style.boxShadow = '0 0 0 3px rgba(192, 57, 43, 0.15)';
    setTimeout(function() {
      input.style.borderColor = '';
      input.style.boxShadow = '';
    }, 1500);
  }

  /* ---- Utilities ---- */
  function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      var d = new Date(isoStr);
      var now = new Date();
      var diff = now - d;

      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  /* ---- Event Listeners ---- */
  function setupEventListeners() {
    var generateBtn = getEl('aiGenerateBtn');
    var quickBtn = getEl('aiQuickTopic');
    var copyBtn = getEl('aiNrCopyBtn');
    var saveBtn = getEl('aiNrSaveBtn');
    var shareBtn = getEl('aiNrShareBtn');
    var discardBtn = getEl('aiNrDiscardBtn');

    if (generateBtn) generateBtn.addEventListener('click', generateArticle);
    if (quickBtn) quickBtn.addEventListener('click', suggestTopic);
    if (copyBtn) copyBtn.addEventListener('click', copyArticle);
    if (saveBtn) saveBtn.addEventListener('click', saveArticle);
    if (shareBtn) shareBtn.addEventListener('click', shareArticle);
    if (discardBtn) discardBtn.addEventListener('click', function() {
      currentArticle = null;
      hideArticle();
      hideStatus();

      var saveBtn2 = getEl('aiNrSaveBtn');
      if (saveBtn2) {
        saveBtn2.disabled = false;
        saveBtn2.querySelector('span').textContent = 'Save';
      }
    });

    /* Enter key on topic input */
    var topicInput = getEl('aiTopicInput');
    if (topicInput) {
      topicInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') generateArticle();
      });
    }
  }

  /* ---- Init ---- */
  function init() {
    if (!document.querySelector('.ai-newsroom-page')) return;
    loadArticles();
    setupEventListeners();
    renderLibrary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
