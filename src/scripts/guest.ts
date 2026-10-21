import { burst, calm, rain, startAmbient } from './particles';

const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const centerOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top };
};

/* ---------- Ambient background ---------- */

const ambient = document.querySelector<HTMLCanvasElement>('canvas[data-ambient]');
if (ambient) startAmbient(ambient, document.querySelector('.home') ? 0.5 : 1);

/* ---------- Envelopes lean toward the pointer ---------- */

const envelopes = [...document.querySelectorAll<HTMLElement>('[data-envelope]')].filter((e) => !e.closest('.opening'));
if (finePointer && !calm() && envelopes.length) {
  addEventListener('pointermove', (e) => {
    for (const env of envelopes) {
      const c = centerOf(env);
      const dx = Math.max(-1, Math.min(1, (e.clientX - c.x) / (innerWidth / 2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - c.y) / (innerHeight / 2)));
      env.style.setProperty('--ry', `${(dx * 14).toFixed(2)}deg`);
      env.style.setProperty('--rx', `${(-dy * 12).toFixed(2)}deg`);
    }
  });
  document.addEventListener('pointerleave', () => {
    for (const env of envelopes) {
      env.style.removeProperty('--rx');
      env.style.removeProperty('--ry');
    }
  });
}

/* ---------- Sign-in: the seal reacts as you type ---------- */

const gateForm = document.querySelector<HTMLFormElement>('.gate-form');
const gateEnvelope = document.querySelector<HTMLElement>('.gate [data-envelope]');
const gateSeal = gateEnvelope?.querySelector<HTMLElement>('.env-seal');

if (gateForm && gateEnvelope && gateSeal) {
  gateForm.addEventListener('input', () => {
    if (calm()) return;
    const tilt = (Math.random() * 18 - 9).toFixed(1);
    gateSeal.animate(
      [{ scale: '1', rotate: '0deg' }, { scale: '1.14', rotate: `${tilt}deg` }, { scale: '1', rotate: '0deg' }],
      { duration: 280, easing: 'cubic-bezier(.3,1.6,.5,1)' },
    );
  });

  const btn = gateForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  const label = btn?.textContent ?? '';
  gateForm.addEventListener('submit', () => {
    gateEnvelope.classList.add('unsealing');
    if (btn?.dataset.busy) {
      btn.classList.add('is-busy');
      btn.textContent = btn.dataset.busy;
    }
  });
  // Coming back with the browser's back button restores a frozen page.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    gateEnvelope.classList.remove('unsealing');
    if (btn) {
      btn.classList.remove('is-busy');
      btn.textContent = label;
    }
  });
}

/* ---------- Opening sequence after signing in ---------- */

const opening = document.querySelector<HTMLElement>('.opening');
let celebrated = false;
const celebrate = () => {
  if (celebrated) return;
  celebrated = true;
  rain(110);
};

if (opening) {
  const seal = opening.querySelector<HTMLElement>('.env-seal');
  seal?.addEventListener('animationend', (e) => {
    if (e.animationName !== 'seal-crack' || document.body.classList.contains('skip-opening')) return;
    const c = centerOf(seal);
    burst(c.x, c.y, { count: 34, power: 0.75 });
  });
  opening.addEventListener('animationstart', (e) => {
    if (e.target === opening && e.animationName === 'opening-fade') celebrate();
  });

  const skip = () => {
    if (document.body.classList.contains('skip-opening')) return;
    document.body.classList.add('skip-opening');
    celebrate();
  };
  opening.addEventListener('click', skip);
  addEventListener('keydown', skip, { once: true });
  addEventListener('wheel', skip, { once: true, passive: true });
}

/* ---------- Invitation card catches the light ---------- */

const card = document.querySelector<HTMLElement>('.card');
if (card && finePointer) {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
    card.classList.add('lit');
  });
  card.addEventListener('pointerleave', () => card.classList.remove('lit'));
}

/* ---------- Live countdown ---------- */

const countdown = document.querySelector<HTMLElement>('[data-countdown]');
if (countdown) {
  const target = Date.parse(countdown.dataset.countdown!);
  const cell = (unit: string) => countdown.querySelector<HTMLElement>(`[data-unit="${unit}"]`)!;
  const cells = { d: cell('d'), h: cell('h'), m: cell('m'), s: cell('s') };
  const set = (el: HTMLElement, value: number, pad: boolean) => {
    const text = pad ? String(value).padStart(2, '0') : String(value);
    if (el.textContent === text) return;
    el.textContent = text;
    if (!calm()) {
      el.animate(
        [
          { translate: '0 -0.45em', opacity: 0, filter: 'blur(2px)' },
          { translate: '0 0', opacity: 1, filter: 'blur(0)' },
        ],
        { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
    }
  };
  const tick = () => {
    const ms = target - Date.now();
    if (ms <= 0) {
      countdown.classList.add('is-now');
      clearInterval(timer);
      return;
    }
    set(cells.d, Math.floor(ms / 864e5), false);
    set(cells.h, Math.floor(ms / 36e5) % 24, true);
    set(cells.m, Math.floor(ms / 6e4) % 60, true);
    set(cells.s, Math.floor(ms / 1e3) % 60, true);
  };
  const timer = setInterval(tick, 1000);
  tick();
}

/* ---------- Sections drift in as you scroll ---------- */

const reveals = document.querySelectorAll<HTMLElement>('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.04 },
  );
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('in'));
}

/* ---------- Section nav follows along ---------- */

const jump = document.querySelector<HTMLElement>('.jump');
// Glide to a section when a chip is tapped. (Not page-wide smooth scrolling:
// that stops the browser landing on #rsvp etc. after a form is saved.)
jump?.addEventListener('click', (e) => {
  const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
  const target = link && document.getElementById(link.hash.slice(1));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth' });
  history.replaceState(null, '', link.hash);
});
if (jump && 'IntersectionObserver' in window) {
  const links = new Map([...jump.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')].map((a) => [a.hash.slice(1), a]));
  const visible = new Set<string>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const active = [...links.keys()].find((id) => visible.has(id));
      links.forEach((a, id) => {
        const on = id === active;
        a.classList.toggle('is-active', on);
        if (on) jump.scrollTo({ left: a.offsetLeft - jump.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
      });
    },
    { rootMargin: '-30% 0px -60% 0px' },
  );
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) io.observe(section);
  });
}

/* ---------- RSVP choices have feelings ---------- */

document.querySelectorAll<HTMLInputElement>('.choice input').forEach((input) => {
  input.addEventListener('change', () => {
    const face = input.nextElementSibling as HTMLElement;
    face.classList.remove('bump');
    void face.offsetWidth; // restart the animation
    face.classList.add('bump');
    if (input.value === 'yes') {
      const c = centerOf(face);
      burst(c.x, c.y, { count: 26, power: 0.6 });
    }
  });
});

/* ---------- Packing list ---------- */

const bring = document.querySelector<HTMLElement>('[data-bring-key]');
if (bring) {
  const key = bring.dataset.bringKey!;
  const boxes = [...bring.querySelectorAll<HTMLInputElement>('input[data-bring]')];
  const meter = bring.querySelector<HTMLElement>('[data-pack-meter]');
  let ticked: string[] = [];
  try {
    ticked = JSON.parse(localStorage.getItem(key) || '[]');
  } catch {}

  const update = (fromTick: boolean) => {
    const done = boxes.filter((b) => b.checked).length;
    const all = done === boxes.length;
    if (meter) {
      meter.hidden = false;
      meter.style.setProperty('--packed', String(done / boxes.length));
      meter.classList.toggle('is-done', all);
      meter.querySelector('.pack-text')!.textContent = all ? 'All packed. See you there!' : `${done} of ${boxes.length} packed`;
      if (fromTick && all) {
        const c = centerOf(meter);
        burst(c.x, c.y, { count: 44, power: 0.9, party: true });
      }
    }
  };

  boxes.forEach((box) => {
    box.checked = ticked.includes(box.dataset.bring!);
    box.addEventListener('change', () => {
      const all = boxes.filter((b) => b.checked).map((b) => b.dataset.bring!);
      try {
        localStorage.setItem(key, JSON.stringify(all));
      } catch {}
      if (box.checked) {
        const c = centerOf(box);
        burst(c.x, c.y, { count: 9, power: 0.28 });
      }
      update(true);
    });
  });
  update(false);
}

/* ---------- Questions ---------- */

const ask = document.querySelector<HTMLFormElement>('.ask-form');
ask?.addEventListener('submit', () => ask.classList.add('is-sending'));

/* ---------- Toasts ---------- */

const flash = document.querySelector<HTMLElement>('.flash');
if (flash) {
  flash.addEventListener('click', () => flash.classList.add('is-leaving'));
  const fx = flash.dataset.fx;
  setTimeout(() => {
    if (fx === 'party') rain(130);
    if (fx === 'gift') {
      const c = centerOf(flash);
      burst(c.x, c.top, { count: 48, power: 1.1, angle: -Math.PI / 2, spread: Math.PI * 0.75, party: true });
    }
  }, 280);
}

/* ---------- Drop one-off query params so a refresh doesn't replay anything ---------- */

const url = new URL(location.href);
if (url.searchParams.has('opened') || url.searchParams.has('m')) {
  url.searchParams.delete('opened');
  url.searchParams.delete('m');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}
