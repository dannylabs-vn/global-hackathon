import { useEffect } from 'react';

export function useInteractionMotion() {
  useEffect(() => {
    const preview = document.getElementById('product');
    const progress = document.querySelector('.reading-progress');
    const links = [...document.querySelectorAll('#top a[href^="#"]')];
    const sections = links.map(link => document.querySelector(link.getAttribute('href')));
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let scrollFrame = 0;
    let pointerFrame = 0;
    let x = 0;
    let y = 0;

    function updateScroll() {
      scrollFrame = 0;
      const distance = document.documentElement.scrollHeight - window.innerHeight;
      progress?.style.setProperty('--progress', distance > 0 ? window.scrollY / distance : 0);
      let active = -1;
      sections.forEach((section, index) => {
        if (section && section.getBoundingClientRect().top <= window.innerHeight * .4) active = index;
      });
      links.forEach((link, index) => {
        if (index === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    function onScroll() {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
    }
    function resetPointer() {
      cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      preview?.style.setProperty('--pointer-x', '0px');
      preview?.style.setProperty('--pointer-y', '0px');
    }
    function onPointerMove(event) {
      if (preference.matches || !pointer.matches || event.pointerType === 'touch') return;
      const rect = preview.getBoundingClientRect();
      x = ((event.clientX - rect.left) / rect.width - .5) * 16;
      y = ((event.clientY - rect.top) / rect.height - .5) * 12;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        preview.style.setProperty('--pointer-x', `${x}px`);
        preview.style.setProperty('--pointer-y', `${y}px`);
      });
    }
    updateScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    preview?.addEventListener('pointermove', onPointerMove, { passive: true });
    preview?.addEventListener('pointerleave', resetPointer);
    preference.addEventListener('change', resetPointer);
    pointer.addEventListener('change', resetPointer);
    return () => {
      cancelAnimationFrame(scrollFrame);
      resetPointer();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      preview?.removeEventListener('pointermove', onPointerMove);
      preview?.removeEventListener('pointerleave', resetPointer);
      preference.removeEventListener('change', resetPointer);
      pointer.removeEventListener('change', resetPointer);
      links.forEach(link => link.removeAttribute('aria-current'));
    };
  }, []);
}
