(() => {
  const gallery = document.querySelector('.app-gallery');
  if (!gallery) return;

  const slides = [...gallery.querySelectorAll('.app-gallery-slide')];
  const dots = [...gallery.querySelectorAll('[data-slide]')];
  const controls = gallery.querySelector('.app-gallery-controls');
  const status = gallery.querySelector('.app-gallery-status');
  const dialog = gallery.querySelector('.app-gallery-lightbox');
  const expandedImage = dialog.querySelector('.app-lightbox-image');
  const expandedTitle = dialog.querySelector('#app-lightbox-title');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mouseHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const touchPointers = new Set();
  let inView = false;
  let hovered = mouseHover.matches && gallery.matches(':hover');
  let autoplayTimer;
  let pendingAutomatic = false;
  let pendingChange = false;
  let active = 0;
  let request = 0;
  let opener;
  let gesture;
  let lastSwipe = 0;

  function canAutoplay() {
    const keyboardFocus = gallery.contains(document.activeElement)
      && document.activeElement.matches(':focus-visible');
    return inView && !pendingChange && !hovered && !dialog.open && !document.hidden
      && !reducedMotion.matches && touchPointers.size === 0 && !keyboardFocus;
  }

  function stopAutoplay() {
    window.clearTimeout(autoplayTimer);
    autoplayTimer = undefined;
    // Pausing invalidates an autoplay load without cancelling a manual selection.
    if (pendingAutomatic) {
      ++request;
      pendingAutomatic = false;
      pendingChange = false;
    }
  }

  function scheduleAutoplay() {
    stopAutoplay();
    if (!canAutoplay()) return;
    autoplayTimer = window.setTimeout(() => {
      autoplayTimer = undefined;
      showSlide(active + 1, true);
    }, 6000);
  }

  async function showSlide(index, automatic = false) {
    stopAutoplay();
    const next = (index + slides.length) % slides.length;
    const currentRequest = ++request;
    pendingChange = false;
    if (next === active || (automatic && !canAutoplay())) {
      scheduleAutoplay();
      return;
    }
    pendingAutomatic = automatic;
    pendingChange = true;
    const image = slides[next].querySelector('img');
    image.loading = 'eager';
    // Reveal the text and screenshot together, after the requested image is ready.
    try { await image.decode(); } catch {
      if (currentRequest === request) {
        pendingAutomatic = false;
        pendingChange = false;
        scheduleAutoplay();
      }
      return;
    }
    if (currentRequest !== request) return;
    pendingAutomatic = false;
    pendingChange = false;
    if (automatic && !canAutoplay()) {
      scheduleAutoplay();
      return;
    }
    const restoreImageFocus = slides[active].contains(document.activeElement);
    slides[active].hidden = true;
    slides[next].hidden = false;
    dots[active].removeAttribute('aria-current');
    dots[next].setAttribute('aria-current', 'true');
    active = next;
    const title = slides[active].querySelector('h3').textContent;
    if (!automatic) {
      status.textContent = `${gallery.dataset.slideLabel} ${active + 1} ${gallery.dataset.ofLabel} ${slides.length}: ${title}`;
    } else {
      status.textContent = '';
    }
    if (restoreImageFocus) slides[active].querySelector('.app-gallery-zoom').focus({ preventScroll: true });
    scheduleAutoplay();
  }

  gallery.querySelectorAll('[data-step]').forEach(button => {
    button.addEventListener('click', () => showSlide(active + Number(button.dataset.step)));
  });
  dots.forEach(button => button.addEventListener('click', () => showSlide(Number(button.dataset.slide))));

  gallery.addEventListener('keydown', event => {
    if (dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
    const targets = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: slides.length - 1 };
    if (Object.hasOwn(targets, event.key)) {
      event.preventDefault();
      showSlide(targets[event.key]);
    }
  });

  gallery.querySelectorAll('.app-gallery-media').forEach(media => {
    media.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    media.addEventListener('pointerup', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      gesture = undefined;
      if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        lastSwipe = Date.now();
        showSlide(active + (dx < 0 ? 1 : -1));
      }
    });
    media.addEventListener('pointercancel', () => { gesture = undefined; });
  });

  gallery.querySelectorAll('.app-gallery-zoom').forEach(button => {
    button.addEventListener('click', event => {
      if (Date.now() - lastSwipe < 400) { event.preventDefault(); return; }
      if (typeof dialog.showModal !== 'function') { window.open(button.dataset.full, '_blank', 'noopener'); return; }
      opener = button;
      expandedImage.src = button.dataset.full;
      expandedImage.alt = button.querySelector('img').alt;
      expandedTitle.textContent = slides[active].querySelector('h3').textContent;
      dialog.showModal();
      document.body.classList.add('app-lightbox-open');
      scheduleAutoplay();
    });
  });
  dialog.querySelector('.app-lightbox-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const panel = dialog.querySelector('.app-lightbox-panel').getBoundingClientRect();
    if (event.clientX < panel.left || event.clientX > panel.right || event.clientY < panel.top || event.clientY > panel.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('app-lightbox-open');
    if (opener) opener.focus({ preventScroll: true });
    scheduleAutoplay();
  });

  gallery.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    hovered = true;
    scheduleAutoplay();
  });
  gallery.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse') return;
    hovered = false;
    scheduleAutoplay();
  });
  // Capture touch interactions anywhere in the gallery, including its controls.
  gallery.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    touchPointers.add(event.pointerId);
    scheduleAutoplay();
  }, { capture: true });
  function releaseTouch(event) {
    if (touchPointers.delete(event.pointerId)) scheduleAutoplay();
  }
  window.addEventListener('pointerup', releaseTouch);
  window.addEventListener('pointercancel', releaseTouch);
  gallery.addEventListener('focusin', scheduleAutoplay);
  gallery.addEventListener('focusout', () => queueMicrotask(scheduleAutoplay));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      touchPointers.clear();
      gesture = undefined;
    } else {
      hovered = mouseHover.matches && gallery.matches(':hover');
    }
    scheduleAutoplay();
  });
  reducedMotion.addEventListener('change', scheduleAutoplay);
  mouseHover.addEventListener('change', () => {
    hovered = mouseHover.matches && gallery.matches(':hover');
    scheduleAutoplay();
  });

  function updateVisibility(visible) {
    if (inView === visible) return;
    inView = visible;
    scheduleAutoplay();
  }
  if ('IntersectionObserver' in window) {
    const observer = new window.IntersectionObserver(entries => {
      const entry = entries[0];
      updateVisibility(entry.isIntersecting && entry.intersectionRatio >= 0.1);
    }, { threshold: [0, 0.1] });
    observer.observe(gallery);
  } else {
    function checkVisibility() {
      const rect = gallery.getBoundingClientRect();
      const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      updateVisibility(visibleHeight >= Math.min(rect.height * 0.1, 100));
    }
    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility);
    checkVisibility();
  }

  controls.hidden = false;
  gallery.classList.add('is-ready');
})();
