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
          creditEl.innerHTML = 'Photo: <a href="' + (article.imageLink || '#') + '" target="_blank" rel="noopener">' + (article.imageCredit || 'Pexels') + '</a> via Pexels';
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

      // Show success
      var resultEl = getEl('manualPublishResult');
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.className = 'ai-nr-publish-result ai-nr-publish-success';
        resultEl.innerHTML =
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
          '<span>Published successfully! Commit <strong>' + (data.commitSha || '') + '</strong>. ' +
          '<a href="' + (data.url || '#') + '" target="_blank" rel="noopener">View article</a> (live in 1-2 min)</span>';
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

  function clearManualForm() {
    if (getEl('manualTitle')) getEl('manualTitle').value = '';
    if (getEl('manualContent')) getEl('manualContent').value = '';
    if (getEl('manualSummary')) getEl('manualSummary').value = '';
    if (getEl('manualAuthor')) getEl('manualAuthor').value = '';
    if (getEl('manualImage')) getEl('manualImage').value = '';
    if (getEl('manualTags')) getEl('manualTags').value = '';
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
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
          '<span>Published successfully! Commit <strong>' + (data.commitSha || '') + '</strong>. ' +
          '<a href="' + (data.url || '#') + '" target="_blank" rel="noopener">View article</a> (live in 1-2 min)</span>';
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
  }

  /* ---- Init ---- */
  function init() {
    if (!document.querySelector('.ai-newsroom-page')) return;
    loadArticles();
    setupEventListeners();
    renderLibrary();
    updateWordCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
