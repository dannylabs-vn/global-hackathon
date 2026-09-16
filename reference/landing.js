const named = (name) => [...document.querySelectorAll('[data-pencil-name]')].filter(el => el.dataset.pencilName === name);
const sections = { '2. Features': 'how-it-works', '2. Gap Map': 'roadmap', '2. Privacy': 'privacy', '2. Hero Cascade': 'product', '3. Device Cascade': 'product' };
const cascade = named('3. Device Cascade')[0];
if (cascade) named('2. Hero')[0].after(cascade);
for (const [name, id] of Object.entries(sections)) {
  const section = named(name)[0];
  if (section) section.id = id;
}
for (const [label, target] of Object.entries({ 'How it works': 'how-it-works', 'Secondary CTA': 'product', Roadmap: 'roadmap', Privacy: 'privacy', Product: 'product' })) {
  for (const el of named(label)) {
    const link = document.createElement('a');
    for (const attribute of el.attributes) link.setAttribute(attribute.name, attribute.value);
    link.href = `#${target}`;
    link.innerHTML = el.innerHTML;
    el.replaceWith(link);
  }
}
function resizePreview() {
  const preview = named('3. Device Cascade')[0] || named('2. Hero Cascade')[0];
  if (!preview) return;
  const scale = Math.min(1, window.innerWidth / 1440);
  preview.style.transform = `scale(${scale})`;
  const height = preview.dataset.pencilName === '3. Device Cascade' ? 1000 : 810;
  preview.style.marginBottom = `${height * (scale - 1)}px`;
}
window.addEventListener('resize', resizePreview);
for (const track of document.querySelectorAll('[data-pencil-name="Map Card"] [data-pencil-name="Track"]')) {
  const bar = track.querySelector('[data-pencil-name="Bar"]');
  const percent = track.parentElement.querySelector('[data-pencil-name="Pct"]');
  if (bar && percent) bar.style.width = percent.textContent.trim();
}
resizePreview();
