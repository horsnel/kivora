/**
 * Newsletter Popup Controller
 * - Shows after 12 seconds on first visit (scroll-triggered)
 * - Cookie-based: once dismissed or subscribed, won't show for 30 days
 * - Integrates with Formspree
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'menshly_nl_popup';
  var COOKIE_DAYS = 30;
  var SHOW_DELAY = 12000; // 12 seconds
  var SCROLL_THRESHOLD = 0.25; // show after scrolling 25% of page

  var overlay, popup, closeBtn, dismissBtn, form, submitBtn, emailInput, errorEl;

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

    // Don't show if cookie is set
    if (getCookie(COOKIE_NAME)) return;

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
    overlay.classList.add('nl-popup-visible');
    document.body.style.overflow = 'hidden';
    // Focus the email input after animation
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
    if (!email) return;

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
        // Success
        if (btnLoading) btnLoading.style.display = 'none';
        if (btnSuccess) btnSuccess.style.display = 'inline-flex';
        submitBtn.style.background = '#27ae60';
        submitBtn.style.borderColor = '#27ae60';
        if (emailInput) {
          emailInput.value = 'You\'re subscribed!';
          emailInput.style.color = '#27ae60';
        }
        setCookie(COOKIE_NAME, 'subscribed', COOKIE_DAYS);
        // Auto close after 2 seconds
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
      if (errorEl) {
        errorEl.textContent = err.message || 'Something went wrong. Please try again.';
        errorEl.style.display = 'block';
      }
    });
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
