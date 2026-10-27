const SLIDES = [
  { dir: '00-title', title: 'Title' },
  { dir: '01-humans-are-the-horses', title: 'Humans are the horses' },
  { dir: '02-no-more-jobs', title: 'No more jobs' },
  { dir: '03-software-engineering-dead', title: 'Is software engineering dead?' },
  { dir: '04-if-we-build-it', title: 'If we build it, everyone dies' },
  { dir: '05-a-simple-formula', title: 'A simple formula' },
  { dir: '06-corporate-vs-ai-governance', title: 'Corporate vs AI governance' },
  { dir: '07-three-questions', title: 'Three questions' },
  { dir: '08-governance-as-brake', title: 'Governance as brake' },
  { dir: '09-good-governance-in-finance', title: 'Good governance in finance' },
  { dir: '10-governance-as-code', title: 'Moving towards governance as code' },
  { dir: '11-ten-factor', title: 'Ten Factor Governance' },
  { dir: '12-ccc-and-gemara', title: 'CCC and Gemara' },
  { dir: '13-governance-as-a-service', title: 'Governance as a service' },
  { dir: '14-demo-stack-1', title: 'Demo stack' },
  { dir: '15-demo-stack-2', title: 'Demo apps' },
  { dir: '16-sail-governance-plugin', title: 'Sail governance plugin' },
  { dir: '17-how-it-decides', title: 'How it decides' },
  { dir: '18-demo', title: 'Demo' },
  { dir: '19-workshop-recap', title: 'Workshop recap' },
  { dir: '20-conclusions', title: 'Conclusions' },
  { dir: '21-governance-needs-to-grow-up', title: 'Governance needs to grow up' },
  { dir: '22-best-tool-for-ai-risk', title: 'Best tool for AI risk' },
  { dir: '23-governance-used-to-be-harder', title: 'Governance used to be harder' },
  { dir: '24-software-engineering-isnt-dead', title: "Software engineering isn't dead" },
  { dir: '25-are-humans-the-new-horses', title: 'Are humans the new horses?' },
  { dir: '26-cognitive-revolution', title: 'A cognitive revolution' },
  { dir: '27-how-to-get-involved', title: 'How to get involved' },
  { dir: '28-belling-the-cat', title: 'Belling the cat' },
  { dir: '29-linkedin', title: 'Thank you' },
];

function currentIndex() {
  const path = decodeURIComponent(window.location.pathname);
  return SLIDES.findIndex((slide) => path.includes(`/${slide.dir}/`));
}

function hrefFor(dir) {
  return `../${dir}/index.html`;
}

function bindNav() {
  const index = currentIndex();
  if (index < 0) return;

  const prev = SLIDES[index - 1];
  const next = SLIDES[index + 1];
  const prevLink = document.querySelector('.nav .prev');
  const nextLink = document.querySelector('.nav .next');
  const num = document.querySelector('.nav .num');

  if (num) num.textContent = `${String(index).padStart(2, '0')} / ${String(SLIDES.length - 1).padStart(2, '0')}`;

  if (prevLink) {
    if (prev) prevLink.href = hrefFor(prev.dir);
    else prevLink.classList.add('is-disabled');
  }
  if (nextLink) {
    if (next) nextLink.href = hrefFor(next.dir);
    else nextLink.classList.add('is-disabled');
  }

  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
      if (next) window.location.href = hrefFor(next.dir);
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      if (prev) window.location.href = hrefFor(prev.dir);
    } else if (event.key === 'Home') {
      window.location.href = hrefFor(SLIDES[0].dir);
    } else if (event.key === 'End') {
      window.location.href = hrefFor(SLIDES[SLIDES.length - 1].dir);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindNav);
} else {
  bindNav();
}
