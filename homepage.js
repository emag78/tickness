(() => {
  const gallery = document.querySelector('.stats-media');
  if (!gallery) return;

  const slides = [...gallery.querySelectorAll('.stats-slide')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;
  let timer;
  let hovered = gallery.matches(':hover');
  let focused = gallery.contains(document.activeElement);

  function schedule() {
    window.clearTimeout(timer);
    if (reducedMotion.matches || hovered || focused || document.hidden) return;
    timer = window.setTimeout(() => {
      const next = (active + 1) % slides.length;
      // Keep the current chart visible if the next image could not be loaded.
      if (slides[next].complete && slides[next].naturalWidth > 0) {
        slides[active].classList.remove('is-active');
        slides[active].setAttribute('aria-hidden', 'true');
        slides[next].classList.add('is-active');
        slides[next].removeAttribute('aria-hidden');
        active = next;
      }
      schedule();
    }, 6000);
  }

  function applyMotionPreference() {
    const animated = !reducedMotion.matches;
    gallery.classList.toggle('is-enhanced', animated);
    slides.forEach((slide, index) => {
      if (animated && index !== active) slide.setAttribute('aria-hidden', 'true');
      else slide.removeAttribute('aria-hidden');
    });
    schedule();
  }

  gallery.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  gallery.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  gallery.addEventListener('focusin', () => { focused = true; schedule(); });
  gallery.addEventListener('focusout', event => {
    focused = gallery.contains(event.relatedTarget);
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', applyMotionPreference);
  applyMotionPreference();
})();
