/* ================================================================
   AI Content Studio — Reviews, Analysis, Guides Generator
   + Manual Post Writer & Publisher
   MenshlyGlobal Client-Side Logic
   ================================================================ */
(function() {
  'use strict';

  var STORAGE_KEY = 'menshly_ai_articles';
  var API_ENDPOINT = '/api/generate-article';
  var PUBLISH_ENDPOINT = '/api/publish-article';
  var DELETE_ENDPOINT = '/api/delete-article';
  var TRENDING_ENDPOINT = '/api/trending-topics';

  var TRENDING_TOPICS = [
    'Dune: Part Two — A visual masterpiece or style over substance?',
    'Top 10 passive income streams that can replace your salary',
    'Why African fintech attracted $2 billion in Q1 2026',
    'Inside Out 2 review: Pixar delivers another emotional gut-punch',
    'How to start investing in stocks with under $500',
    'The global electric vehicle market — trends, data, and forecasts',
    'The Bear Season 4: Has the magic faded or gotten better?',
    'Personal finance habits of self-made millionaires',
    'Remote work statistics 2026: How many people actually work from home?',
    'Deadpool & Wolverine review: Fan service at its finest',
    'Small business failure rates by industry — what the data says',
    'Productivity tools that save entrepreneurs 20+ hours per week',
    'Gladiator II review: Can Ridley Scott recapture the magic?',
    'E-commerce in 2026: Is it still profitable for new sellers?',
    'The creator economy — how much do creators actually earn?',
    'Best business ideas for beginners with no coding experience',
    'Social media marketing ROI for small businesses in 2026',
    'How to flip items on eBay and Facebook Marketplace for profit',
    'Global startup funding trends — where the money is flowing',
    'Shogun Season 2: What to expect from the epic finale'
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

  /* ---- Tab Switching ---- */
  function setupTabs() {
    var tabs = document.querySelectorAll('.ai-nr-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = this.getAttribute('data-tab');
        // Deactivate all tabs
        tabs.forEach(function(t) { t.classList.remove('ai-nr-tab-active'); });
        document.querySelectorAll('.ai-nr-tab-content').forEach(function(c) {
          c.classList.remove('ai-nr-tab-content-active');
          c.style.display = 'none';
        });
        // Activate clicked tab
        this.classList.add('ai-nr-tab-active');
        var content = getEl('tab-' + target);
        if (content) {
          content.classList.add('ai-nr-tab-content-active');
          content.style.display = '';
        }
      });
    });
  }

  /* ---- Status Display ---- */
  function showStatus(type, message, containerId) {
    var elId = containerId || 'aiNewsroomStatus';
    var el = getEl(elId);
    if (!el) return;
    el.style.display = 'flex';
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
      el.style.display = 'flex';
    } else {
      setTimeout(function() { el.style.display = 'none'; }, type === 'error' ? 8000 : 5000);
    }
  }

  function hideStatus(containerId) {
    var elId = containerId || 'aiNewsroomStatus';
    var el = getEl(elId);
    if (el) el.style.display = 'none';
  }

  /* ---- Article Generation (AI Studio) ---- */
  async function generateArticle() {
    var topicInput = getEl('aiTopicInput');
    var categorySelect = getEl('aiCategorySelect');
    var toneSelect = getEl('aiToneSelect');
    var lengthSelect = getEl('aiLengthSelect');
    var generateBtn = getEl('aiGenerateBtn');

    var topic = (topicInput.value || '').trim();
    if (!topic) {
      showStatus('error', 'Please enter a topic.');
      topicInput.focus();
      return;
    }
    if (topic.length < 3) {
      showStatus('error', 'Topic must be at least 3 characters.');
      topicInput.focus();
      return;
    }

    var category = categorySelect.value;
    var tone = toneSelect.value;
    var length = lengthSelect.value;

    generateBtn.disabled = true;
    generateBtn.classList.add('ai-nr-generating');
    generateBtn.querySelector('span').textContent = 'Generating...';
    showStatus('loading', 'Generating your content. This may take 10-30 seconds...');
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
          errMsg += ' Set AI_API_KEY in Cloudflare env vars.';
        }
        throw new Error(errMsg);
      }

      currentArticle = data;
      displayArticle(data);
      showStatus('success', 'Content generated successfully!');

    } catch (err) {
      showStatus('error', err.message || 'Failed to generate. Please try again.');
    } finally {
      generateBtn.disabled = false;
      generateBtn.classList.remove('ai-nr-generating');
      generateBtn.querySelector('span').textContent = 'Generate Content';
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
      var imageWrap = getEl('aiNrArticleImage');
      var imgEl = getEl('aiNrArticleImg');
      var creditEl = getEl('aiNrImgCredit');

      if (catEl) catEl.textContent = article.category || 'Analysis';
      if (timeEl) timeEl.textContent = formatDate(article.generatedAt);
      if (titleEl) titleEl.textContent = article.title || article.topic;
      if (summaryEl) summaryEl.textContent = article.summary || '';
      if (readTimeEl) readTimeEl.textContent = (article.readTime || 3) + ' min read';
      if (bodyEl) bodyEl.innerHTML = article.content || '<p>No content generated.</p>';

      if (article.image && imgEl) {
        imgEl.src = article.image;
        imgEl.alt = article.title || article.topic;
        if (creditEl) {
          var creditText = (article.imageCredit || 'Source');
          var viaText = article.imageStatus === 'pexels' ? 'via Pexels' : '';
          creditEl.innerHTML = 'Photo: <a href="' + (article.imageLink || '#') + '" target="_blank" rel="noopener">' + creditText + '</a> ' + viaText;
        }
        if (imageWrap) imageWrap.style.display = 'block';
      } else if (imageWrap) {
        imageWrap.style.display = 'none';
      }
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
    var exists = savedArticles.some(function(a) { return a.id === currentArticle.id; });
    if (exists) {
      showStatus('warning', 'Already saved in your library.');
      return;
    }
    savedArticles.unshift(currentArticle);
    if (savedArticles.length > 50) savedArticles = savedArticles.slice(0, 50);
    saveArticles();
    showStatus('success', 'Saved to your library!');
    var saveBtn = getEl('aiNrSaveBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.querySelector('span').textContent = 'Saved';
    }
  }

  function deleteArticle(id) {
    savedArticles = savedArticles.filter(function(a) { return a.id !== id; });
    saveArticles();
    showStatus('success', 'Removed from library.');
  }

  function viewArticle(id) {
    var article = savedArticles.find(function(a) { return a.id === id; });
    if (article) {
      currentArticle = article;
      displayArticle(article);
      window.scrollTo({ top: 300, behavior: 'smooth' });
      var saveBtn = getEl('aiNrSaveBtn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.querySelector('span').textContent = 'Saved';
      }
    }
  }

  function copyArticle() {
    if (!currentArticle) return;
    var text = '# ' + (currentArticle.title || '') + '\n\n';
    text += (currentArticle.summary || '') + '\n\n';
    text += (currentArticle.content || '').replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n');
    navigator.clipboard.writeText(text).then(function() {
      showStatus('success', 'Copied to clipboard!');
    }).catch(function() {
      showStatus('error', 'Failed to copy.');
    });
  }

  function shareToX(publishUrl, articleTitle) {
    var url = publishUrl || (currentArticle && currentArticle.publishUrl) || window.location.href;
    var title = articleTitle || (currentArticle && currentArticle.title) || '';
    var text = encodeURIComponent(title);
    var encodedUrl = encodeURIComponent(url);
    window.open('https://twitter.com/intent/tweet?text=' + text + '&url=' + encodedUrl + '&via=MenshlyGlobal', '_blank', 'width=600,height=400');
  }

  function copyShareLink(publishUrl) {
    var url = publishUrl || (currentArticle && currentArticle.publishUrl) || window.location.href;
    navigator.clipboard.writeText(url).then(function() {
      showStatus('success', 'Link copied to clipboard!');
    }).catch(function() {
      showStatus('error', 'Failed to copy link.');
    });
  }

  function shareArticle() {
    if (!currentArticle) return;
    var url = currentArticle.publishUrl || window.location.href;
    var title = currentArticle.title || '';
    if (navigator.share) {
      navigator.share({
        title: title,
        text: currentArticle.summary,
        url: url
      }).catch(function() {});
    } else {
      shareToX(url, title);
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
          '<p>No saved content yet</p>' +
          '<span>Generated reviews, analysis, and guides will appear here</span></div>';
      }
      return;
    }

    var html = '';
    savedArticles.forEach(function(article) {
      html += '<div class="ai-library-card" data-id="' + article.id + '">';
      if (article.imageThumb) {
        html += '<div class="ai-library-card-img"><img src="' + article.imageThumb + '" alt="" loading="lazy"></div>';
      }
      html += '<div class="ai-library-card-cat">' + (article.category || 'Analysis') + '</div>';
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

  /* ================================================================
     MANUAL POST FUNCTIONS
     ================================================================ */

  function slugify(text) {
    var s = text.toLowerCase().trim();
    s = s.replace(/['\u2019\u2018""\u201C\u201D]/g, '');
    s = s.replace(/[^\w\s-]/g, '');
    s = s.replace(/[\s_]+/g, '-');
    s = s.replace(/^-+|-+$/g, '');
    return s.substring(0, 80) || 'article-' + Date.now();
  }

  /* Simple Markdown to HTML converter */
  function markdownToHtml(md) {
    if (!md) return '';
    var html = md;
    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Code blocks (``` ... ```)
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    // Unordered lists
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    // Paragraphs: wrap remaining lines
    html = html.replace(/^(?!<[a-z])((?!<\/)[^\n]+)$/gm, '<p>$1</p>');
    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    // Clean up consecutive blockquotes into one
    html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');
    return html;
  }

  function updateWordCount() {
    var textarea = getEl('manualContent');
    var counter = getEl('manualWordCount');
    if (!textarea || !counter) return;
    var text = textarea.value.trim();
    var words = text ? text.split(/\s+/).length : 0;
    counter.textContent = words + ' word' + (words !== 1 ? 's' : '');
    if (words < 50) {
      counter.style.color = 'var(--accent)';
    } else {
      counter.style.color = 'var(--text-muted)';
    }
  }

  function previewManualPost() {
    var title = (getEl('manualTitle').value || '').trim();
    var content = (getEl('manualContent').value || '').trim();
    var summary = (getEl('manualSummary').value || '').trim();
    var category = getEl('manualCategory').value;
    var author = (getEl('manualAuthor').value || '').trim();
    var image = (getEl('manualImage').value || '').trim();

    if (!title) {
      showStatus('error', 'Please enter an article title.', 'manualPostStatus');
      getEl('manualTitle').focus();
      return;
    }
    if (content.length < 20) {
      showStatus('error', 'Content is too short. Write at least a paragraph.', 'manualPostStatus');
      getEl('manualContent').focus();
      return;
    }

    // Fill preview panel
    var catEl = getEl('previewCat');
    var timeEl = getEl('previewTime');
    var titleEl = getEl('previewTitle');
    var summaryEl = getEl('previewSummary');
    var authorEl = getEl('previewAuthor');
    var readTimeEl = getEl('previewReadTime');
    var bodyEl = getEl('previewBody');
    var imageWrap = getEl('previewImageWrap');
    var imageEl = getEl('previewImage');
    var panel = getEl('manualPreviewPanel');

    if (catEl) catEl.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    if (timeEl) timeEl.textContent = 'Just now';
    if (titleEl) titleEl.textContent = title;
    if (summaryEl) summaryEl.textContent = summary || '';
    if (authorEl) authorEl.textContent = author || 'MenshlyGlobal Staff';
    var wordCount = content.split(/\s+/).length;
    if (readTimeEl) readTimeEl.textContent = Math.max(1, Math.ceil(wordCount / 200)) + ' min read';

    if (bodyEl) bodyEl.innerHTML = markdownToHtml(content);

    if (image && imageEl) {
      imageEl.src = image;
      imageEl.alt = title;
      if (imageWrap) imageWrap.style.display = 'block';
    } else if (imageWrap) {
      imageWrap.style.display = 'none';
    }

    if (panel) {
      panel.style.display = 'block';
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function closeManualPreview() {
    var panel = getEl('manualPreviewPanel');
    if (panel) panel.style.display = 'none';
  }

  function previewImage() {
    var url = (getEl('manualImage').value || '').trim();
    var previewWrap = getEl('manualImgPreview');
    var previewEl = getEl('manualImgPreviewEl');
    if (!url) {
      showStatus('error', 'Enter an image URL first.', 'manualPostStatus');
      return;
    }
    if (previewEl) {
      previewEl.src = url;
      previewEl.onload = function() {
        if (previewWrap) previewWrap.style.display = 'block';
      };
      previewEl.onerror = function() {
        showStatus('error', 'Could not load image. Check the URL.', 'manualPostStatus');
        if (previewWrap) previewWrap.style.display = 'none';
      };
    }
  }

  function removeImagePreview() {
    var previewWrap = getEl('manualImgPreview');
    var previewEl = getEl('manualImgPreviewEl');
    if (previewWrap) previewWrap.style.display = 'none';
    if (previewEl) previewEl.src = '';
  }

  async function publishManualPost() {
    var title = (getEl('manualTitle').value || '').trim();
    var content = (getEl('manualContent').value || '').trim();
    var summary = (getEl('manualSummary').value || '').trim();
    var category = getEl('manualCategory').value;
    var author = (getEl('manualAuthor').value || '').trim();
    var image = (getEl('manualImage').value || '').trim();
    var tags = (getEl('manualTags').value || '').trim();

    // Validation
    if (!title) {
      showStatus('error', 'Article title is required.', 'manualPostStatus');
      getEl('manualTitle').focus();
      return;
    }
    if (content.length < 50) {
      showStatus('error', 'Article content must be at least 50 characters. Current: ' + content.length + '.', 'manualPostStatus');
      getEl('manualContent').focus();
      return;
    }

    var publishBtn = getEl('manualPublishBtn');
    if (!publishBtn) return;

    // Confirm
    var confirmed = confirm('Publish this article to MenshlyGlobal?\n\nTitle: ' + title + '\nCategory: ' + category + '\n\nThe article will be live within 1-2 minutes.');
    if (!confirmed) return;

    publishBtn.disabled = true;
    publishBtn.classList.add('ai-nr-generating');
    publishBtn.querySelector('span').textContent = 'Publishing...';
    showStatus('loading', 'Publishing article to GitHub...', 'manualPostStatus');

    // Convert markdown content to HTML for the publish endpoint
    var htmlContent = markdownToHtml(content);

    // Map category label for display
    var categoryLabels = {
      'world': 'World News',
      'technology': 'Technology',
      'business': 'Business',
      'finance': 'Finance',
      'entertainment': 'Entertainment',
      'sports': 'Sports',
      'science': 'Science',
      'health': 'Health',
      'opinion': 'Opinion'
    };
    var catLabel = categoryLabels[category] || 'World News';

    try {
      // Build the publish payload
      var payload = {
        title: title,
        summary: summary,
        content: htmlContent,
        category: catLabel,
        image: image || null,
        topic: title,
        tone: 'feature'
      };
      // Include author if provided
      if (author) payload.author = author;
      // Include tags if provided
      if (tags) payload.tags = tags;
      // Include series if provided
      var series = (getEl('manualSeries').value || '').trim();
      if (series) payload.series = series;
      var seriesOrder = (getEl('manualSeriesOrder').value || '').trim();
      if (seriesOrder) payload.series_order = parseInt(seriesOrder);

      var response = await fetch(PUBLISH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var data = await response.json();

      if (!response.ok || data.error) {
        var errMsg = data.error || 'Unknown error occurred';
        if (response.status === 503) {
          errMsg += ' Set GITHUB_TOKEN and GITHUB_REPO in Cloudflare env vars.';
        }
        throw new Error(errMsg);
      }

      // Show success with share buttons
      var resultEl = getEl('manualPublishResult');
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.className = 'ai-nr-publish-result ai-nr-publish-success';
        resultEl.innerHTML =
          '<div class="ai-nr-pub-success-main">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
          '<span>Published successfully! Commit <strong>' + (data.commitSha || '') + '</strong>. ' +
          '<a href="' + (data.url || '#') + '" target="_blank" rel="noopener">View article</a></span></div>' +
          '<div class="ai-nr-pub-share-actions">' +
          '<button class="ai-nr-share-x-btn" onclick="window._nr_shareToX('' + (data.url || '') + '','' + title.replace(/'/g, "\'") + '')" type="button">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
          ' Share to X</button>' +
          '<button class="ai-nr-copy-link-btn" onclick="window._nr_copyShareLink('' + (data.url || '') + '')" type="button">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
          ' Copy Link</button></div>';
      }

      showStatus('success', 'Article published! It will appear on the site within 1-2 minutes.', 'manualPostStatus');
      publishBtn.querySelector('span').textContent = 'Published!';
      publishBtn.classList.add('ai-nr-published');

    } catch (err) {
      showStatus('error', 'Publish failed: ' + (err.message || 'Unknown error'), 'manualPostStatus');
      var resultEl = getEl('manualPublishResult');
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.className = 'ai-nr-publish-result ai-nr-publish-error';
        resultEl.innerHTML = '<span>' + (err.message || 'Publish failed') + '</span>';
      }
    } finally {
      publishBtn.disabled = false;
      publishBtn.classList.remove('ai-nr-generating');
    }
  }


  /* ================================================================
     HEADLINE REWRITER
     ================================================================ */
  var REWRITE_ENDPOINT = "/api/rewrite-headline";

  async function rewriteHeadline() {
    var titleInput = getEl("editTitle");
    var btn = getEl("rewriteTitleBtn");
    var chipsContainer = getEl("headlineSuggestions");
    var statusEl = getEl("headlineStatus");

    if (!titleInput || !btn) return;
    var title = (titleInput.value || "").trim();
    if (title.length < 5) {
      showStatus("error", "Enter a title first (at least 5 characters).", "headlineStatus");
      titleInput.focus();
      return;
    }

    btn.disabled = true;
    btn.style.opacity = "0.5";
    if (chipsContainer) chipsContainer.style.display = "none";
    showStatus("loading", "Generating alternative headlines...", "headlineStatus");

    try {
      var response = await fetch(REWRITE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title })
      });

      var data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to generate headlines");
      }

      if (data.headlines && data.headlines.length > 0 && chipsContainer) {
        var html = "";
        data.headlines.forEach(function(h) {
          html += '<button class="ai-nr-headline-chip" data-headline="' + h.replace(/"/g, "&quot;") + '">' + h + '</button>';
        });
        chipsContainer.innerHTML = html;
        chipsContainer.style.display = "flex";
        hideStatus("headlineStatus");

        chipsContainer.querySelectorAll(".ai-nr-headline-chip").forEach(function(chip) {
          chip.addEventListener("click", function() {
            var val = this.getAttribute("data-headline");
            if (titleInput) titleInput.value = val;
            chipsContainer.style.display = "none";
          });
        });
      } else {
        showStatus("error", "No headlines generated. Try again.", "headlineStatus");
      }
    } catch (err) {
      showStatus("error", "Rewrite failed: " + (err.message || "Unknown error"), "headlineStatus");
    } finally {
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  }

  /* ================================================================
     BREAKING NEWS ADMIN
     ================================================================ */
  var BREAKING_NEWS_ENDPOINT = "/api/breaking-news";

  async function loadBreakingNews() {
    var headlineInput = getEl("breakingHeadlineInput");
    var linkInput = getEl("breakingLinkInput");
    if (!headlineInput) return;

    try {
      var response = await fetch(BREAKING_NEWS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get" })
      });
      var data = await response.json();
      if (data.active && data.headline) {
        headlineInput.value = data.headline;
        if (linkInput) linkInput.value = data.link || "";
      }
    } catch (e) {
      // Silent fail - just leave inputs empty
    }
  }

  async function activateBreakingNews() {
    var headlineInput = getEl("breakingHeadlineInput");
    var linkInput = getEl("breakingLinkInput");
    var btn = getEl("breakingActivateBtn");

    if (!headlineInput) return;
    var headline = (headlineInput.value || "").trim();
    if (!headline) {
      showStatus("error", "Please enter a breaking news headline.", "breakingNewsStatus");
      headlineInput.focus();
      return;
    }

    var confirmed = confirm("Activate breaking news alert site-wide?\n\nHeadline: " + headline + "\n\nThis will appear on every page immediately.");
    if (!confirmed) return;

    btn.disabled = true;
    btn.querySelector("span").textContent = "Activating...";
    showStatus("loading", "Saving breaking news to GitHub...", "breakingNewsStatus");

    try {
      var response = await fetch(BREAKING_NEWS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          headline: headline,
          link: (linkInput ? (linkInput.value || "").trim() : "")
        })
      });
      var data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to save breaking news");
      }
      showStatus("success", "Breaking news activated! It will appear site-wide within 1-2 minutes.", "breakingNewsStatus");
      btn.querySelector("span").textContent = "Activated!";
    } catch (err) {
      showStatus("error", "Failed: " + (err.message || "Unknown error"), "breakingNewsStatus");
    } finally {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Activate";
    }
  }

  async function clearBreakingNews() {
    var headlineInput = getEl("breakingHeadlineInput");
    var linkInput = getEl("breakingLinkInput");
    var confirmed = confirm("Clear the breaking news alert?");
    if (!confirmed) return;

    showStatus("loading", "Clearing breaking news...", "breakingNewsStatus");
    try {
      var response = await fetch(BREAKING_NEWS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" })
      });
      var data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to clear breaking news");
      }
      if (headlineInput) headlineInput.value = "";
      if (linkInput) linkInput.value = "";
      showStatus("success", "Breaking news cleared.", "breakingNewsStatus");
    } catch (err) {
      showStatus("error", "Failed: " + (err.message || "Unknown error"), "breakingNewsStatus");
    }
  }

  /* ================================================================
     TRENDING TOPICS
     ================================================================ */
  async function fetchTrendingTopics() {
    var container = getEl('aiTrendingChips');
    var refreshBtn = getEl('aiTrendingRefresh');
    if (!container) return;

    if (refreshBtn) {
      refreshBtn.style.opacity = '0.5';
      refreshBtn.style.pointerEvents = 'none';
    }
    container.innerHTML = '<span class="ai-trending-loading"><div class="ai-nr-spinner" style="width:14px;height:14px;"></div> Loading topics...</span>';

    try {
      var response = await fetch(TRENDING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: '' })
      });

      var data = await response.json();
      if (data.topics && data.topics.length > 0) {
        renderTopicChips(data.topics);
      } else {
        container.innerHTML = '<span class="ai-trending-loading">No topics available. Try again.</span>';
      }
    } catch (err) {
      container.innerHTML = '<span class="ai-trending-loading">Could not load topics. Click refresh to retry.</span>';
    }

    if (refreshBtn) {
      refreshBtn.style.opacity = '1';
      refreshBtn.style.pointerEvents = '';
    }
  }

  function renderTopicChips(topics) {
    var container = getEl('aiTrendingChips');
    if (!container) return;

    var html = '';
    topics.forEach(function(t) {
      var cat = (t.category || '').charAt(0).toUpperCase() + (t.category || '').slice(1).toLowerCase();
      html += '<button class="ai-trending-chip" data-topic="' + (t.topic || '').replace(/"/g, '&quot;') + '" title="' + (t.reason || '') + '">';
      html += '<span class="ai-trending-chip-cat">' + cat + '</span>';
      html += '<span class="ai-trending-chip-text">' + (t.topic || '') + '</span>';
      html += '</button>';
    });
    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll('.ai-trending-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var topic = this.getAttribute('data-topic');
        var input = getEl('aiTopicInput');
        if (input && topic) {
          input.value = topic;
          input.focus();
          input.style.borderColor = 'var(--accent)';
          input.style.boxShadow = '0 0 0 3px rgba(192, 57, 43, 0.15)';
          setTimeout(function() {
            input.style.borderColor = '';
            input.style.boxShadow = '';
          }, 1500);
        }
      });
    });
  }

  function clearManualForm() {
    if (getEl('manualTitle')) getEl('manualTitle').value = '';
    if (getEl('manualContent')) getEl('manualContent').value = '';
    if (getEl('manualSummary')) getEl('manualSummary').value = '';
    if (getEl('manualAuthor')) getEl('manualAuthor').value = '';
    if (getEl('manualImage')) getEl('manualImage').value = '';
    if (getEl('manualTags')) getEl('manualTags').value = '';
    if (getEl('manualSeries')) getEl('manualSeries').value = '';
    if (getEl('manualSeriesOrder')) getEl('manualSeriesOrder').value = '';
    removeImagePreview();
    closeManualPreview();
    updateWordCount();
    // Reset publish button
    var publishBtn = getEl('manualPublishBtn');
    if (publishBtn) {
      publishBtn.querySelector('span').textContent = 'Publish Article';
      publishBtn.classList.remove('ai-nr-published');
    }
    var resultEl = getEl('manualPublishResult');
    if (resultEl) resultEl.style.display = 'none';
    hideStatus('manualPostStatus');
  }

  /* ---- Publish Article to Site (AI Studio) ---- */
  async function publishArticle() {
    if (!currentArticle) {
      showStatus('error', 'No article to publish. Generate one first.');
      return;
    }

    var publishBtn = getEl('aiNrPublishBtn');
    if (!publishBtn) return;

    var confirmed = confirm('Publish this article to MenshlyGlobal?\n\nTitle: ' + (currentArticle.title || '') + '\n\nThe article will be live on the site within 1-2 minutes.');
    if (!confirmed) return;

    publishBtn.disabled = true;
    publishBtn.classList.add('ai-nr-publishing');
    publishBtn.querySelector('span').textContent = 'Publishing...';
    showStatus('loading', 'Publishing article to site...');

    try {
      var response = await fetch(PUBLISH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentArticle.title,
          summary: currentArticle.summary,
          content: currentArticle.content,
          category: currentArticle.category,
          image: currentArticle.image,
          imageCredit: currentArticle.imageCredit,
          imageLink: currentArticle.imageLink,
          topic: currentArticle.topic,
          tone: currentArticle.tone
        })
      });

      var data = await response.json();

      if (!response.ok || data.error) {
        var errMsg = data.error || 'Unknown error occurred';
        if (response.status === 503) {
          errMsg += ' Set GITHUB_TOKEN and GITHUB_REPO in Cloudflare env vars.';
        }
        throw new Error(errMsg);
      }

      var resultEl = getEl('aiNrPublishResult');
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.className = 'ai-nr-publish-result ai-nr-publish-success';
        resultEl.innerHTML =
          '<div class="ai-nr-pub-success-main">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
          '<span>Published successfully! Commit <strong>' + (data.commitSha || '') + '</strong>. ' +
          '<a href="' + (data.url || '#') + '" target="_blank" rel="noopener">View article</a></span></div>' +
          '<div class="ai-nr-pub-share-actions">' +
          '<button class="ai-nr-share-x-btn" onclick="window._nr_shareToX('' + (data.url || '') + '','' + (currentArticle.title || '').replace(/'/g, "\'") + '')" type="button">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
          ' Share to X</button>' +
          '<button class="ai-nr-copy-link-btn" onclick="window._nr_copyShareLink('' + (data.url || '') + '')" type="button">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
          ' Copy Link</button></div>';
      }

      var exists = savedArticles.some(function(a) { return a.id === currentArticle.id; });
      if (!exists) {
        currentArticle.published = true;
        currentArticle.publishUrl = data.url;
        savedArticles.unshift(currentArticle);
        saveArticles();
      }

      showStatus('success', 'Article published! It will appear on the site within 1-2 minutes.');
      publishBtn.querySelector('span').textContent = 'Published';
      publishBtn.classList.add('ai-nr-published');

    } catch (err) {
      showStatus('error', 'Publish failed: ' + (err.message || 'Unknown error'));
      var resultEl = getEl('aiNrPublishResult');
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.className = 'ai-nr-publish-result ai-nr-publish-error';
        resultEl.innerHTML = '<span>' + (err.message || 'Publish failed') + '</span>';
      }
    } finally {
      publishBtn.disabled = false;
      publishBtn.classList.remove('ai-nr-publishing');
    }
  }

  /* ================================================================
     DELETE PUBLISHED ARTICLE
     ================================================================ */
  async function deletePublishedArticle(slug, title) {
    if (!slug) return;

    var confirmed = confirm('Delete this article permanently?\n\nTitle: ' + (title || slug) + '\n\nThis cannot be undone. The article will be removed within 1-2 minutes.');
    if (!confirmed) return;

    // Find the delete button and disable it
    var deleteBtn = document.querySelector('.ai-nr-pub-delete-btn[data-slug="' + slug + '"]');
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.querySelector('svg') && (deleteBtn.innerHTML = '<svg class="ai-nr-spinner" width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="30 70"/></svg> Deleting...');
    }

    try {
      var response = await fetch(DELETE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug, section: 'ai-newsroom' })
      });

      var data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Delete failed');
      }

      // Remove the card from the DOM
      var cardWrap = document.querySelector('.ai-nr-pub-card-wrap[data-slug="' + slug + '"]');
      if (cardWrap) {
        cardWrap.style.transition = 'opacity 0.3s, transform 0.3s';
        cardWrap.style.opacity = '0';
        cardWrap.style.transform = 'scale(0.95)';
        setTimeout(function() {
          cardWrap.remove();
          // Update the count
          var grid = document.getElementById('aiNewsroomPublishedGrid');
          if (grid) {
            var remaining = grid.querySelectorAll('.ai-nr-pub-card-wrap');
            var countEl = grid.parentElement.querySelector('.ai-newsroom-library-count');
            if (countEl) countEl.textContent = remaining.length + ' article' + (remaining.length !== 1 ? 's' : '');
            // Show empty state if no articles left
            if (remaining.length === 0) {
              var publishedSection = grid.closest('.ai-newsroom-published');
              if (publishedSection) publishedSection.remove();
            }
          }
        }, 300);
      }

      showStatus('success', 'Article deleted. It will be removed from the site within 1-2 minutes.');

    } catch (err) {
      showStatus('error', 'Delete failed: ' + (err.message || 'Unknown error'));
      // Reset the button
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete';
      }
    }
  }

  /* ================================================================
     EDIT POST FUNCTIONS
     ================================================================ */
  var GET_ARTICLE_ENDPOINT = "/api/get-article";
  var UPDATE_ARTICLE_ENDPOINT = "/api/update-article";
  var editArticleData = null; /* Stores fetched article data + SHA */

  function populateEditSelect() {
    var select = getEl("editArticleSelect");
    if (!select) return;

    /* Clear existing options except first */
    while (select.options.length > 1) select.remove(1);

    /* Get published articles from the DOM */
    var cards = document.querySelectorAll(".ai-nr-pub-card-wrap");
    cards.forEach(function(card) {
      var slug = card.getAttribute("data-slug") || "";
      var title = card.getAttribute("data-title") || slug;
      if (slug) {
        var opt = document.createElement("option");
        opt.value = slug;
        opt.textContent = title.length > 60 ? title.substring(0, 57) + "..." : title;
        select.appendChild(opt);
      }
    });
  }

  async function loadArticleForEditing() {
    var select = getEl("editArticleSelect");
    var formContainer = getEl("editFormContainer");
    var loadStatus = getEl("editLoadStatus");
    if (!select || !select.value) {
      if (formContainer) formContainer.style.display = "none";
      return;
    }

    var slug = select.value;
    showStatus("loading", "Loading article content from GitHub...", "editLoadStatus");

    try {
      var response = await fetch(GET_ARTICLE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug, section: "ai-newsroom" })
      });

      var data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to load article");
      }

      editArticleData = data;

      /* Populate form fields */
      var fm = data.frontMatter || {};
      if (getEl("editTitle")) getEl("editTitle").value = fm.title || slug;
      if (getEl("editCategory")) getEl("editCategory").value = (fm.categories && fm.categories[0]) || "";
      if (getEl("editAuthor")) getEl("editAuthor").value = fm.author || "";
      if (getEl("editDescription")) getEl("editDescription").value = fm.description || "";
      if (getEl("editTags")) getEl("editTags").value = Array.isArray(fm.tags) ? fm.tags.join(", ") : (fm.tags || "");
      if (getEl("editImage")) getEl("editImage").value = fm.image || "";
      if (getEl("editSeries")) getEl("editSeries").value = fm.series || "";
      if (getEl("editSeriesOrder")) getEl("editSeriesOrder").value = fm.series_order || "";
      if (getEl("editBody")) getEl("editBody").value = data.body || "";

      if (formContainer) formContainer.style.display = "block";
      hideStatus("editLoadStatus");
      updateEditWordCount();

    } catch (err) {
      showStatus("error", "Failed to load: " + (err.message || "Unknown error"), "editLoadStatus");
    }
  }

  function updateEditWordCount() {
    var textarea = getEl("editBody");
    var counter = getEl("editWordCount");
    if (!textarea || !counter) return;
    var text = textarea.value.trim();
    var words = text ? text.split(/\s+/).length : 0;
    counter.textContent = words + " word" + (words !== 1 ? "s" : "");
  }

  function previewEditChanges() {
    var title = (getEl("editTitle").value || "").trim();
    var body = (getEl("editBody").value || "").trim();
    var category = (getEl("editCategory").value || "").trim();
    var author = (getEl("editAuthor").value || "").trim();
    var image = (getEl("editImage").value || "").trim();

    var catEl = getEl("editPreviewCat");
    var titleEl = getEl("editPreviewTitle");
    var authorEl = getEl("editPreviewAuthor");
    var bodyEl = getEl("editPreviewBody");
    var imageWrap = getEl("editPreviewImageWrap");
    var imageEl = getEl("editPreviewImage");
    var panel = getEl("editPreviewPanel");

    if (catEl) catEl.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    if (titleEl) titleEl.textContent = title || "Untitled";
    if (authorEl) authorEl.textContent = author || "";
    if (bodyEl) bodyEl.innerHTML = markdownToHtml(body);

    if (image && imageEl) {
      imageEl.src = image;
      if (imageWrap) imageWrap.style.display = "block";
    } else if (imageWrap) {
      imageWrap.style.display = "none";
    }

    if (panel) {
      panel.style.display = "block";
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function closeEditPreview() {
    var panel = getEl("editPreviewPanel");
    if (panel) panel.style.display = "none";
  }

  async function saveEditedArticle() {
    if (!editArticleData) {
      showStatus("error", "No article loaded for editing.", "editSaveStatus");
      return;
    }

    var title = (getEl("editTitle").value || "").trim();
    var body = (getEl("editBody").value || "").trim();
    var author = (getEl("editAuthor").value || "").trim();
    var description = (getEl("editDescription").value || "").trim();
    var tagsStr = (getEl("editTags").value || "").trim();
    var image = (getEl("editImage").value || "").trim();

    if (!title) {
      showStatus("error", "Title is required.", "editSaveStatus");
      return;
    }
    if (body.length < 50) {
      showStatus("error", "Content too short (min 50 chars).", "editSaveStatus");
      return;
    }

    var confirmed = confirm("Save changes to:\n\n" + title + "\n\nThe site will rebuild with your edits in 1-2 minutes.");
    if (!confirmed) return;

    var saveBtn = getEl("editSaveBtn");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.querySelector("span").textContent = "Saving...";
    }
    showStatus("loading", "Saving changes to GitHub...", "editSaveStatus");

    /* Build updated front matter */
    var fm = Object.assign({}, editArticleData.frontMatter);
    fm.title = title;
    fm.author = author || fm.author;
    fm.description = description || fm.description;
    if (image) fm.image = image;
    if (getEl("editSeries")) {
      var editSeries = (getEl("editSeries").value || "").trim();
      if (editSeries) fm.series = editSeries;
      else delete fm.series;
    }
    if (getEl("editSeriesOrder")) {
      var editSeriesOrder = (getEl("editSeriesOrder").value || "").trim();
      if (editSeriesOrder) fm.series_order = parseInt(editSeriesOrder);
      else delete fm.series_order;
    }
    if (tagsStr) {
      fm.tags = tagsStr.split(",").map(function(t) { return t.trim(); }).filter(function(t) { return t.length > 0; });
    }

    try {
      var response = await fetch(UPDATE_ARTICLE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: editArticleData.slug,
          sha: editArticleData.sha,
          frontMatter: fm,
          body: body,
          section: "ai-newsroom"
        })
      });

      var data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Update failed");
      }

      var resultEl = getEl("editSaveResult");
      if (resultEl) {
        resultEl.style.display = "block";
        resultEl.className = "ai-nr-publish-result ai-nr-publish-success";
        resultEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Updated! Commit <strong>' + (data.commitSha || "") + '</strong>. Changes live in 1-2 min.</span>';
      }

      showStatus("success", "Article updated successfully!", "editSaveStatus");

      /* Refresh the SHA in case they want to edit again */
      if (data.sha) editArticleData.sha = data.sha;

    } catch (err) {
      showStatus("error", "Save failed: " + (err.message || "Unknown"), "editSaveStatus");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.querySelector("span").textContent = "Save Changes";
      }
    }
  }

  function cancelEdit() {
    if (getEl("editFormContainer")) getEl("editFormContainer").style.display = "none";
    closeEditPreview();
    editArticleData = null;
    hideStatus("editSaveStatus");
    var resultEl = getEl("editSaveResult");
    if (resultEl) resultEl.style.display = "none";
  }

  /* Open Edit tab from published article Edit button */
  function openEditForSlug(slug, title) {
    /* Switch to Edit tab */
    var tabs = document.querySelectorAll(".ai-nr-tab");
    tabs.forEach(function(t) { t.classList.remove("ai-nr-tab-active"); });
    document.querySelectorAll(".ai-nr-tab-content").forEach(function(c) {
      c.classList.remove("ai-nr-tab-content-active");
      c.style.display = "none";
    });
    var editTab = document.querySelector('.ai-nr-tab[data-tab="edit"]');
    if (editTab) editTab.classList.add("ai-nr-tab-active");
    var editContent = getEl("tab-edit");
    if (editContent) {
      editContent.classList.add("ai-nr-tab-content-active");
      editContent.style.display = "";
    }

    /* Select the article in dropdown */
    var select = getEl("editArticleSelect");
    if (select) {
      select.value = slug;
      loadArticleForEditing();
    }

    /* Scroll to edit tab */
    if (editContent) {
      editContent.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ---- Event Listeners ---- */
  function setupEventListeners() {
    // Tab switching
    setupTabs();

    // AI Studio
    var generateBtn = getEl('aiGenerateBtn');
    var quickBtn = getEl('aiQuickTopic');
    var copyBtn = getEl('aiNrCopyBtn');
    var saveBtn = getEl('aiNrSaveBtn');
    var shareBtn = getEl('aiNrShareBtn');
    var discardBtn = getEl('aiNrDiscardBtn');
    var publishBtn = getEl('aiNrPublishBtn');

    if (generateBtn) generateBtn.addEventListener('click', generateArticle);
    if (quickBtn) quickBtn.addEventListener('click', suggestTopic);
    if (copyBtn) copyBtn.addEventListener('click', copyArticle);
    if (saveBtn) saveBtn.addEventListener('click', saveArticle);
    if (shareBtn) shareBtn.addEventListener('click', shareArticle);
    if (publishBtn) publishBtn.addEventListener('click', publishArticle);
    if (generateBtn) generateBtn.addEventListener('click', function() {
      var publishBtn2 = getEl('aiNrPublishBtn');
      if (publishBtn2) {
        publishBtn2.disabled = false;
        publishBtn2.querySelector('span').textContent = 'Publish';
        publishBtn2.classList.remove('ai-nr-published');
      }
      var resultEl = getEl('aiNrPublishResult');
      if (resultEl) resultEl.style.display = 'none';
    });

    if (discardBtn) discardBtn.addEventListener('click', function() {
      currentArticle = null;
      hideArticle();
      hideStatus();
      var saveBtn2 = getEl('aiNrSaveBtn');
      if (saveBtn2) {
        saveBtn2.disabled = false;
        saveBtn2.querySelector('span').textContent = 'Save';
      }
      var publishBtn2 = getEl('aiNrPublishBtn');
      if (publishBtn2) {
        publishBtn2.disabled = false;
        publishBtn2.querySelector('span').textContent = 'Publish';
        publishBtn2.classList.remove('ai-nr-published');
      }
      var resultEl = getEl('aiNrPublishResult');
      if (resultEl) resultEl.style.display = 'none';
    });

    var topicInput = getEl('aiTopicInput');
    if (topicInput) {
      topicInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') generateArticle();
      });
    }

    // Manual Post
    var contentEl = getEl('manualContent');
    if (contentEl) contentEl.addEventListener('input', updateWordCount);

    var previewBtn = getEl('manualPreviewBtn');
    if (previewBtn) previewBtn.addEventListener('click', previewManualPost);

    var closePreviewBtn = getEl('manualClosePreview');
    if (closePreviewBtn) closePreviewBtn.addEventListener('click', closeManualPreview);

    var previewImgBtn = getEl('manualPreviewImg');
    if (previewImgBtn) previewImgBtn.addEventListener('click', previewImage);

    var removeImgBtn = getEl('manualRemoveImg');
    if (removeImgBtn) removeImgBtn.addEventListener('click', removeImagePreview);

    var manualPublishBtn = getEl('manualPublishBtn');
    if (manualPublishBtn) manualPublishBtn.addEventListener('click', publishManualPost);

    var clearBtn = getEl('manualClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearManualForm);

    // Published articles — delete buttons
    var publishedGrid = getEl('aiNewsroomPublishedGrid');
    if (publishedGrid) {
      publishedGrid.querySelectorAll('.ai-nr-pub-delete-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var slug = this.getAttribute('data-slug');
          var title = this.getAttribute('data-title');
          deletePublishedArticle(slug, title);
        });
      });
    }
  }

    // Edit Post tab
    var editSelect = getEl("editArticleSelect");
    if (editSelect) editSelect.addEventListener("change", loadArticleForEditing);

    var editPreviewBtn = getEl("editPreviewBtn");
    if (editPreviewBtn) editPreviewBtn.addEventListener("click", previewEditChanges);

    var editClosePreviewBtn = getEl("editClosePreview");
    if (editClosePreviewBtn) editClosePreviewBtn.addEventListener("click", closeEditPreview);

    var editSaveBtn = getEl("editSaveBtn");
    if (editSaveBtn) editSaveBtn.addEventListener("click", saveEditedArticle);

    var editCancelBtn = getEl("editCancelBtn");
    if (editCancelBtn) editCancelBtn.addEventListener("click", cancelEdit);

    // Headline rewriter
    var rewriteTitleBtn = getEl("rewriteTitleBtn");
    if (rewriteTitleBtn) rewriteTitleBtn.addEventListener("click", rewriteHeadline);

    // Trending topics
    var trendingRefreshBtn = getEl("aiTrendingRefresh");
    if (trendingRefreshBtn) trendingRefreshBtn.addEventListener("click", fetchTrendingTopics);

    // Breaking news admin
    var breakingActivateBtn = getEl("breakingActivateBtn");
    if (breakingActivateBtn) breakingActivateBtn.addEventListener("click", activateBreakingNews);
    var breakingClearBtn = getEl("breakingClearBtn");
    if (breakingClearBtn) breakingClearBtn.addEventListener("click", clearBreakingNews);
    // Load current breaking news state
    loadBreakingNews();

    var editBodyEl = getEl("editBody");
    if (editBodyEl) editBodyEl.addEventListener("input", updateEditWordCount);

    // Published articles - edit buttons
    var publishedGrid = getEl("aiNewsroomPublishedGrid");
    if (publishedGrid) {
      publishedGrid.querySelectorAll(".ai-nr-pub-edit-btn").forEach(function(btn) {
        btn.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          var slug = this.getAttribute("data-slug");
          var title = this.getAttribute("data-title");
          openEditForSlug(slug, title);
        });
      });
    }


  /* ================================================================
     CONTENT CALENDAR
     ================================================================ */
  var calYear = new Date().getFullYear();
  var calMonth = new Date().getMonth();
  var calArticleDates = {}; /* key: "YYYY-MM-DD", value: [{title, href, cat, img}] */

  function getArticleDates() {
    calArticleDates = {};
    var cards = document.querySelectorAll('.ai-nr-pub-card-wrap[data-date]');
    cards.forEach(function(card) {
      var dateStr = card.getAttribute('data-date') || '';
      var title = card.getAttribute('data-title') || '';
      var href = card.querySelector('a') ? card.querySelector('a').getAttribute('href') : '#';
      var catEl = card.querySelector('.ai-nr-pub-cat');
      var cat = catEl ? catEl.textContent : '';
      var imgEl = card.querySelector('a img');
      var img = imgEl ? imgEl.getAttribute('src') : '';

      if (!calArticleDates[dateStr]) calArticleDates[dateStr] = [];
      calArticleDates[dateStr].push({ title: title, href: href, cat: cat, img: img });
    });
  }

  function renderCalendar(year, month) {
    calYear = year;
    calMonth = month;

    var labelEl = getEl('aiNrCalMonthLabel');
    if (labelEl) {
      var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      labelEl.textContent = monthNames[month]] + ' ' + year;
    }

    var bodyEl = getEl('aiNrCalBody');
    if (!bodyEl) return;

    var today = new Date();
    var todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var daysInPrevMonth = new Date(year, month, 0).getDate();

    var html = '';

    /* Previous month trailing days */
    for (var i = firstDay - 1; i >= 0; i--) {
      var day = daysInPrevMonth - i;
      html += '<div class="ai-nr-cal-day ai-nr-cal-other">' + day + '</div>';
    }

    /* Current month days */
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var hasArticles = calArticleDates[dateStr] && calArticleDates[dateStr].length > 0;
      var isToday = dateStr === todayStr;
      var classes = 'ai-nr-cal-day';
      if (isToday) classes += ' ai-nr-cal-today';
      if (hasArticles) classes += ' ai-nr-cal-has-articles';

      var dotHtml = '';
      if (hasArticles) {
        var count = calArticleDates[dateStr].length;
        dotHtml = '<span class="ai-nr-cal-dot">' + count + '</span>';
      }

      html += '<div class="' + classes + '" data-date="' + dateStr + '">' +
        '<span class="ai-nr-cal-day-num">' + d + '</span>' + dotHtml + '</div>';
    }

    /* Next month leading days */
    var totalCells = firstDay + daysInMonth;
    var remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (var r = 1; r <= remaining; r++) {
      html += '<div class="ai-nr-cal-day ai-nr-cal-other">' + r + '</div>';
    }

    bodyEl.innerHTML = html;

    /* Attach click handlers to clickable days */
    bodyEl.querySelectorAll('.ai-nr-cal-has-articles').forEach(function(cell) {
      cell.addEventListener('click', function() {
        showCalendarDetail(this.getAttribute('data-date'));
      });
    });
  }

  function showCalendarDetail(dateStr) {
    var detailEl = getEl('aiNrCalDetail');
    var titleEl = getEl('aiNrCalDetailTitle');
    var articlesEl = getEl('aiNrCalDetailArticles');
    if (!detailEl || !articlesEl) return;

    var articles = calArticleDates[dateStr] || [];
    if (articles.length === 0) {
      detailEl.style.display = 'none';
      return;
    }

    /* Parse date for display */
    var parts = dateStr.split('-');
    var dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var displayDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    if (titleEl) titleEl.textContent = displayDate;

    var html = '';
    articles.forEach(function(article) {
      html += '<a class="ai-nr-cal-article" href="' + article.href + '">';
      if (article.img) {
        html += '<img src="' + article.img + '" alt="" loading="lazy">';
      }
      html += '<div class="ai-nr-cal-article-body">';
      if (article.cat) {
        html += '<span class="ai-nr-pub-cat">' + article.cat + '</span>';
      }
      html += '<h5>' + article.title + '</h5>';
      html += '</div></a>';
    });
    articlesEl.innerHTML = html;

    detailEl.style.display = 'block';
    detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setupCalendar() {
    getArticleDates();
    renderCalendar(calYear, calMonth);

    var prevBtn = getEl('aiNrCalPrev');
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        renderCalendar(calYear, calMonth);
      });
    }

    var nextBtn = getEl('aiNrCalNext');
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
        renderCalendar(calYear, calMonth);
      });
    }

    var closeBtn = getEl('aiNrCalDetailClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        var detailEl = getEl('aiNrCalDetail');
        if (detailEl) detailEl.style.display = 'none';
      });
    }
  }

  /* ---- Init ---- */
  /* Expose share functions globally for inline onclick handlers */
  window._nr_shareToX = shareToX;
  window._nr_copyShareLink = copyShareLink;

  function init() {
    if (!document.querySelector('.ai-newsroom-page')) return;
    loadArticles();
    setupEventListeners();
    renderLibrary();
    updateWordCount();
    populateEditSelect();
    setupCalendar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
