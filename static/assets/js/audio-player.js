/* ================================================================
   Audio Player — Text-to-Speech for Article Pages
   MenshlyGlobal Client-Side Logic
   ================================================================ */
(function() {
  'use strict';
  if (!window.speechSynthesis) return;

  var synth = window.speechSynthesis;
  var playing = false;
  var paused = false;
  var speeds = [0.75, 1, 1.25, 1.5, 2];
  var speedIdx = 1;
  var currentUtterance = null;
  var articleChunks = [];
  var chunkIndex = 0;
  var resumeTimer = null;

  // Modern SVG icons
  var ICONS = {
    headphones: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
    play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>',
    stop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>',
    forward: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>',
    volume: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  function createPlayer() {
    var article = document.querySelector('.post-content');
    if (!article) return;

    var wrapper = document.createElement('div');
    wrapper.id = 'audio-player-wrap';
    wrapper.innerHTML =
      '<div class="audio-player-bar" id="audioPlayerBar">' +
        '<button class="audio-btn audio-listen-btn" id="audioListenBtn" title="Listen to article">' +
          ICONS.headphones +
          '<span>Listen to Article</span>' +
        '</button>' +
        '<div class="audio-controls" id="audioControls" style="display:none">' +
          '<button class="audio-btn" id="audioPlayPause" title="Play/Pause">' +
            ICONS.play +
          '</button>' +
          '<button class="audio-btn" id="audioStopBtn" title="Stop">' +
            ICONS.stop +
          '</button>' +
          '<button class="audio-btn audio-speed-btn" id="audioSpeedBtn" title="Playback speed">1x</button>' +
          '<span class="audio-status" id="audioStatus">Preparing...</span>' +
          '<button class="audio-btn audio-close-btn" id="audioCloseBtn" title="Close player">' +
            ICONS.close +
          '</button>' +
        '</div>' +
      '</div>';

    article.parentNode.insertBefore(wrapper, article.nextSibling);

    document.getElementById('audioListenBtn').addEventListener('click', startAudio);
    document.getElementById('audioPlayPause').addEventListener('click', togglePlayPause);
    document.getElementById('audioSpeedBtn').addEventListener('click', cycleSpeed);
    document.getElementById('audioStopBtn').addEventListener('click', stopAudio);
    document.getElementById('audioCloseBtn').addEventListener('click', stopAudio);
  }

  function getArticleText() {
    var article = document.querySelector('.post-content');
    if (!article) return '';
    // Get clean text, skip scripts/styles
    var clone = article.cloneNode(true);
    var scripts = clone.querySelectorAll('script, style, .audio-player-bar, iframe, noscript');
    scripts.forEach(function(el) { el.remove(); });
    var text = clone.innerText || clone.textContent || '';
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    // Limit to avoid browser TTS limits (most browsers cap at ~15k chars)
    return text.substring(0, 15000);
  }

  function startAudio() {
    // Cancel any existing speech
    synth.cancel();

    var text = getArticleText();
    if (!text || text.length < 10) {
      updateStatus('No article text found.');
      return;
    }

    // Split text into chunks of ~3000 chars to avoid Chrome's 15-second pause bug
    articleChunks = [];
    var chunkSize = 3000;
    for (var i = 0; i < text.length; i += chunkSize) {
      var chunk = text.substring(i, i + chunkSize);
      // Try to break at sentence end
      if (i + chunkSize < text.length) {
        var lastPeriod = Math.max(chunk.lastIndexOf('.'), chunk.lastIndexOf('!'), chunk.lastIndexOf('?'));
        if (lastPeriod > chunkSize * 0.5) {
          chunk = chunk.substring(0, lastPeriod + 1);
          i = i - (chunkSize - lastPeriod - 1);
        }
      }
      articleChunks.push(chunk.trim());
    }

    chunkIndex = 0;
    playing = true;
    paused = false;

    document.getElementById('audioControls').style.display = 'flex';
    document.getElementById('audioListenBtn').style.display = 'none';
    updatePlayPauseIcon();
    speakChunk();
  }

  function speakChunk() {
    if (!playing || chunkIndex >= articleChunks.length) {
      onEnd();
      return;
    }

    currentUtterance = new SpeechSynthesisUtterance(articleChunks[chunkIndex]);
    currentUtterance.rate = speeds[speedIdx];
    currentUtterance.pitch = 1;

    // Try to pick a good voice
    var voices = synth.getVoices();
    var preferred = voices.find(function(v) { return v.lang.startsWith('en') && v.name.indexOf('Google') !== -1; })
                   || voices.find(function(v) { return v.lang.startsWith('en-US'); })
                   || voices.find(function(v) { return v.lang.startsWith('en'); });
    if (preferred) currentUtterance.voice = preferred;

    currentUtterance.onend = function() {
      chunkIndex++;
      updateStatus('Playing... (' + Math.min(chunkIndex, articleChunks.length) + '/' + articleChunks.length + ')');
      // Small delay before next chunk to prevent glitches
      setTimeout(function() {
        if (playing && !paused) speakChunk();
      }, 50);
    };

    currentUtterance.onerror = function(e) {
      if (e.error !== 'canceled') {
        updateStatus('Error: ' + e.error);
      }
    };

    synth.speak(currentUtterance);
    updateStatus('Playing... (' + (chunkIndex + 1) + '/' + articleChunks.length + ')');
  }

  function togglePlayPause() {
    if (!playing) {
      startAudio();
      return;
    }

    if (paused) {
      synth.resume();
      paused = false;
      updateStatus('Playing... (' + (chunkIndex + 1) + '/' + articleChunks.length + ')');
      // Chrome has a bug where speech pauses after ~15s. This workaround keeps it alive.
      clearInterval(resumeTimer);
      resumeTimer = setInterval(function() {
        if (synth.speaking && !synth.paused) {
          synth.pause();
          synth.resume();
        }
      }, 10000);
    } else {
      synth.pause();
      paused = true;
      updateStatus('Paused');
      clearInterval(resumeTimer);
    }
    updatePlayPauseIcon();
  }

  function cycleSpeed() {
    speedIdx = (speedIdx + 1) % speeds.length;
    var speed = speeds[speedIdx];
    document.getElementById('audioSpeedBtn').textContent = speed + 'x';
    // Update current utterance if speaking
    if (currentUtterance) {
      currentUtterance.rate = speed;
    }
    // If speaking, restart with new speed
    if (playing && !paused && synth.speaking) {
      synth.cancel();
      speakChunk();
    }
  }

  function stopAudio() {
    synth.cancel();
    playing = false;
    paused = false;
    clearInterval(resumeTimer);
    document.getElementById('audioControls').style.display = 'none';
    document.getElementById('audioListenBtn').style.display = 'flex';
    currentUtterance = null;
    articleChunks = [];
    chunkIndex = 0;
  }

  function onEnd() {
    playing = false;
    paused = false;
    clearInterval(resumeTimer);
    updateStatus('Finished');
    updatePlayPauseIcon();
    setTimeout(function() {
      document.getElementById('audioControls').style.display = 'none';
      document.getElementById('audioListenBtn').style.display = 'flex';
    }, 2000);
  }

  function updateStatus(text) {
    var el = document.getElementById('audioStatus');
    if (el) el.textContent = text;
  }

  function updatePlayPauseIcon() {
    var btn = document.getElementById('audioPlayPause');
    if (btn) {
      btn.innerHTML = paused ? ICONS.play : ICONS.pause;
      btn.title = paused ? 'Resume' : 'Pause';
    }
  }

  // Ensure voices are loaded (some browsers load them asynchronously)
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = function() {};
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createPlayer);
  } else {
    createPlayer();
  }
})();
