/**
 * Newsletter Popup Controller
 * - Shows after 12 seconds on first visit (scroll-triggered)
 * - Cookie-based: once dismissed or subscribed, won't show for 30 days
 * - Session-based: also checks localStorage for session-level dismissal
 * - Integrates with Formspree
 * - Email validation before submission
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'menshly_nl_popup';
  var COOKIE_DAYS = 30;
  var SESSION_KEY = 'menshly_nl_session';
  var SHOW_DELAY = 12000;
  var SCROLL_THRESHOLD = 0.25;

  var overlay, popup, closeBtn, dismissBtn, form, submitBtn, emailInput, errorEl;

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function hasSessionShown() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === 'shown';
    } catch (e) {
      return false;
    }
  }

  function markSessionShown() {
    try {
      sessionStorage.setItem(SESSION_KEY, 'shown');
    } catch (e) {}
  }

  function init() {
    overlay = document.getElementById('nlPopupOverlay');
    if (!overlay) return;

    popup = document.getElementById('nlPopup');
    closeBtn = document.getElementById('nlPopupClose');
    dismissBtn = document.getElementById('nlPopupDismiss');
    form = document.getElementById('nlPopupForm');
    submitBtn = document.getElementById('nlPopupSubmit');
    emailInput = document.getElementById('nlPopupEmail');
    errorEl = document.getElementById('nlPopupError');

    if (!popup) return;

    // Don't show if cookie is set or already shown this session
    if (getCookie(COOKIE_NAME) || hasSessionShown()) return;

    // Bind events
    closeBtn.addEventListener('click', closePopup);
    dismissBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePopup();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePopup();
    });

    if (form) {
      form.addEventListener('submit', handleSubmit);
    }

    // Show after delay OR after scrolling (whichever comes first)
    var shown = false;
    var timer = setTimeout(function () {
      if (!shown) { shown = true; showPopup(); }
    }, SHOW_DELAY);

    window.addEventListener('scroll', function () {
      if (shown) return;
      var scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1);
      if (scrollPercent >= SCROLL_THRESHOLD) {
        shown = true;
        clearTimeout(timer);
        showPopup();
      }
    }, { passive: true });
  }

  function showPopup() {
    markSessionShown();
    overlay.classList.add('nl-popup-visible');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      if (emailInput) emailInput.focus();
    }, 400);
  }

  function closePopup() {
    overlay.classList.remove('nl-popup-visible');
    document.body.style.overflow = '';
    setCookie(COOKIE_NAME, 'dismissed', COOKIE_DAYS);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form) return;

    var email = emailInput ? emailInput.value.trim() : '';

    // Email validation
    if (!email) {
      showError('Please enter your email address.');
      if (emailInput) { emailInput.focus(); emailInput.style.borderColor = '#e74c3c'; }
      return;
    }

    if (!isValidEmail(email)) {
      showError('Please enter a valid email address.');
      if (emailInput) { emailInput.focus(); emailInput.style.borderColor = '#e74c3c'; }
      return;
    }

    // Reset error styling
    if (emailInput) emailInput.style.borderColor = '';

    // UI: loading state
    var btnText = submitBtn.querySelector('.nl-popup-btn-text');
    var btnLoading = submitBtn.querySelector('.nl-popup-btn-loading');
    var btnSuccess = submitBtn.querySelector('.nl-popup-btn-success');
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'inline-flex';
    submitBtn.disabled = true;
    if (emailInput) emailInput.disabled = true;
    if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

    // Submit to Formspree via fetch
    var formData = new FormData(form);

    fetch(form.action, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' }
    })
    .then(function (response) {
      if (response.ok) {
        // Success state
        if (btnLoading) btnLoading.style.display = 'none';
        if (btnSuccess) btnSuccess.style.display = 'inline-flex';
        submitBtn.style.background = '#27ae60';
        submitBtn.style.borderColor = '#27ae60';
        if (emailInput) {
          emailInput.value = "You're subscribed!";
          emailInput.style.color = '#27ae60';
          emailInput.style.borderColor = '#27ae60';
        }
        setCookie(COOKIE_NAME, 'subscribed', COOKIE_DAYS);
        setTimeout(function () {
          overlay.classList.remove('nl-popup-visible');
          document.body.style.overflow = '';
        }, 2500);
      } else {
        return response.json().then(function (data) {
          throw new Error(data.error || 'Something went wrong');
        }).catch(function () {
          throw new Error('Please try again.');
        });
      }
    })
    .catch(function (err) {
      // Error state
      if (btnLoading) btnLoading.style.display = 'none';
      if (btnText) btnText.style.display = 'inline';
      submitBtn.disabled = false;
      if (emailInput) emailInput.disabled = false;
      showError(err.message || 'Something went wrong. Please try again.');
    });
  }

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
  }

  /* Cookie helpers */
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
