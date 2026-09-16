import { useEffect } from 'react';

export function useReveal() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer;
    const sections = [...document.querySelectorAll('.reveal')];
    function setup() {
      observer?.disconnect();
      sections.forEach(el => el.classList.remove('reveal-pending'));
      if (media.matches) return;
      observer = new IntersectionObserver(entries => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          target.classList.remove('reveal-pending');
          target.classList.add('revealed');
          observer.unobserve(target);
        });
      }, { threshold: 0.08 });
      sections.forEach(el => { if (!el.classList.contains('revealed')) { el.classList.add('reveal-pending'); observer.observe(el); } });
    }
    setup();
    media.addEventListener('change', setup);
    return () => { observer?.disconnect(); media.removeEventListener('change', setup); sections.forEach(el => el.classList.remove('reveal-pending')); };
  }, []);
}
