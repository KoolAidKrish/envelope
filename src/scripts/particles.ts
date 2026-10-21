// Themed particles: a calm ambient layer behind the page, and short bursts for
// celebrations. Each theme gets its own shape so the effects match the mood.

type Kind = 'star' | 'petal' | 'confetti' | 'spark';

const THEME_FX: Record<string, { kind: Kind; colors: string[] }> = {
  midnight: { kind: 'star', colors: ['#f3d98b', '#c9a24a', '#ffffff', '#b9c0ea'] },
  garden: { kind: 'petal', colors: ['#e8a5b5', '#b45d72', '#f2bfcb', '#9dbb8f', '#d98ea1'] },
  confetti: { kind: 'confetti', colors: ['#ff6b35', '#ffd23f', '#ffffff', '#3ee8b5', '#ff5fa2'] },
  ember: { kind: 'spark', colors: ['#ffb36b', '#d08447', '#ffd9a8', '#ff6a3d'] },
};

export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function themeFx() {
  return THEME_FX[document.documentElement.dataset.theme ?? ''] ?? THEME_FX.midnight;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  size: number;
  color: string;
  phase: number;
  age: number;
  life: number;
  gravity: number;
  drag: number;
  round: boolean;
}

function make(kind: Kind, colors: string[], x: number, y: number): Particle {
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    rot: rand(0, Math.PI * 2),
    spin: rand(-3, 3),
    flip: rand(0, Math.PI * 2),
    flipSpeed: rand(3, 8),
    size: kind === 'spark' ? rand(1.2, 2.6) : kind === 'star' ? rand(2, 5) : kind === 'petal' ? rand(6, 11) : rand(4, 8),
    color: pick(colors),
    phase: rand(0, Math.PI * 2),
    age: 0,
    life: 1,
    gravity: 0,
    drag: 0,
    round: Math.random() < 0.25,
  };
}

function draw(ctx: CanvasRenderingContext2D, p: Particle, alpha: number) {
  if (alpha <= 0.01) return;
  const s = p.size;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  switch (p.kind) {
    case 'star': {
      // Four-point sparkle.
      ctx.moveTo(0, -s * 1.6);
      ctx.quadraticCurveTo(0, 0, s * 1.6, 0);
      ctx.quadraticCurveTo(0, 0, 0, s * 1.6);
      ctx.quadraticCurveTo(0, 0, -s * 1.6, 0);
      ctx.quadraticCurveTo(0, 0, 0, -s * 1.6);
      ctx.fill();
      break;
    }
    case 'petal': {
      ctx.scale(Math.cos(p.flip) * 0.6 + 0.4, 1);
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.9, -s * 0.5, s * 0.6, s * 0.8, 0, s);
      ctx.bezierCurveTo(-s * 0.6, s * 0.8, -s * 0.9, -s * 0.5, 0, -s);
      ctx.fill();
      break;
    }
    case 'confetti': {
      ctx.scale(1, Math.cos(p.flip));
      if (p.round) ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
      else ctx.rect(-s * 0.6, -s * 0.3, s * 1.2, s * 0.6);
      ctx.fill();
      break;
    }
    case 'spark': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.22;
      ctx.arc(0, 0, s * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.globalAlpha = alpha;
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function fit(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ---------------- Ambient layer ---------------- */

export function startAmbient(canvas: HTMLCanvasElement, density = 1) {
  if (calm()) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { kind, colors } = themeFx();
  fit(canvas, ctx);
  addEventListener('resize', () => fit(canvas, ctx));

  const count = Math.round(Math.max(14, Math.min(64, (innerWidth * innerHeight) / 21000)) * density);
  const pointer = { x: -999, y: -999 };
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });
  document.addEventListener('pointerleave', () => (pointer.x = pointer.y = -999));

  const spawn = (p: Particle | null, scatter: boolean): Particle => {
    const q = p ?? make(kind, colors, 0, 0);
    q.x = rand(0, innerWidth);
    q.age = 0;
    if (kind === 'star') {
      q.y = rand(0, innerHeight);
      q.vx = rand(-3, 3);
      q.vy = rand(-2, 2);
      q.life = Infinity;
    } else if (kind === 'spark') {
      q.y = scatter ? rand(0, innerHeight) : innerHeight + 10;
      q.vy = rand(-55, -20);
      q.life = rand(5, 11);
      if (scatter) q.age = rand(0, q.life * 0.7);
    } else {
      q.y = scatter ? rand(-20, innerHeight) : -20;
      q.vy = rand(14, kind === 'petal' ? 34 : 42);
      q.life = Infinity;
    }
    return q;
  };

  const parts = Array.from({ length: count }, () => spawn(null, true));
  let streak: { x: number; y: number; vx: number; vy: number; age: number } | null = null;
  let nextStreak = performance.now() + rand(3000, 7000);

  let last = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    for (const p of parts) {
      p.age += dt;
      if (kind === 'star') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (kind === 'spark') {
        p.x += (p.vx + Math.sin(t * 1.6 + p.phase) * 14) * dt;
        p.y += p.vy * dt;
      } else {
        p.x += (Math.sin(t * 0.7 + p.phase) * 18 + 6) * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * 0.3 * dt;
        p.flip += p.flipSpeed * 0.35 * dt;
      }

      // Drift away from the pointer, as if it stirs the air.
      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const d = Math.hypot(dx, dy);
      if (d < 110 && d > 0.1) {
        const push = ((110 - d) / 110) * 90 * dt;
        p.x += (dx / d) * push;
        p.y += (dy / d) * push;
      }

      let alpha = 0.75;
      if (kind === 'star') alpha = 0.18 + 0.62 * (0.5 + 0.5 * Math.sin(t * (0.6 + (p.phase % 1.4)) + p.phase));
      if (kind === 'spark') {
        const k = p.age / p.life;
        alpha = Math.min(1, k * 6) * (1 - k) * (0.65 + 0.35 * Math.sin(t * 9 + p.phase));
      }
      alpha *= density < 1 ? 0.7 : 1;

      const out = p.y > innerHeight + 30 || p.y < -40 || p.x < -40 || p.x > innerWidth + 40 || p.age > p.life;
      if (out) spawn(p, false);
      else draw(ctx, p, alpha);
    }

    // Midnight gets the odd shooting star.
    if (kind === 'star') {
      if (!streak && now > nextStreak) {
        streak = { x: rand(innerWidth * 0.1, innerWidth * 0.8), y: rand(0, innerHeight * 0.35), vx: rand(500, 750), vy: rand(160, 260), age: 0 };
      }
      if (streak) {
        streak.age += dt;
        streak.x += streak.vx * dt;
        streak.y += streak.vy * dt;
        const fade = Math.max(0, 1 - streak.age / 0.9);
        const tail = 0.14;
        const g = ctx.createLinearGradient(streak.x, streak.y, streak.x - streak.vx * tail, streak.y - streak.vy * tail);
        g.addColorStop(0, `rgba(255, 244, 214, ${0.9 * fade})`);
        g.addColorStop(1, 'rgba(255, 244, 214, 0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(streak.x, streak.y);
        ctx.lineTo(streak.x - streak.vx * tail, streak.y - streak.vy * tail);
        ctx.stroke();
        if (fade <= 0) {
          streak = null;
          nextStreak = now + rand(5000, 11000);
        }
      }
    }

    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });
}

/* ---------------- Bursts ---------------- */

let fxCanvas: HTMLCanvasElement | null = null;
let fxCtx: CanvasRenderingContext2D | null = null;
const live: Particle[] = [];
let fxRunning = false;

function layer() {
  if (!fxCanvas) {
    fxCanvas = document.createElement('canvas');
    fxCanvas.className = 'fx-layer';
    fxCanvas.setAttribute('aria-hidden', 'true');
    document.body.append(fxCanvas);
    fxCtx = fxCanvas.getContext('2d');
    addEventListener('resize', () => fxCtx && fit(fxCanvas!, fxCtx));
  }
  if (fxCtx) fit(fxCanvas, fxCtx);
  return fxCtx;
}

function run() {
  if (fxRunning) return;
  fxRunning = true;
  let last = performance.now();
  const frame = (now: number) => {
    const ctx = fxCtx!;
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.age += dt;
      const slow = Math.max(0, 1 - p.drag * dt);
      p.vx *= slow;
      p.vy *= slow;
      p.vy += p.gravity * dt;
      const flutter = p.kind === 'confetti' || p.kind === 'petal' ? Math.sin(p.age * 7 + p.phase) * 40 : 0;
      p.x += (p.vx + flutter) * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.flip += p.flipSpeed * dt;
      const k = p.age / p.life;
      if (k >= 1 || p.y > innerHeight + 40) {
        live.splice(i, 1);
        continue;
      }
      const twinkle = p.kind === 'star' ? 0.7 + 0.3 * Math.sin(p.age * 22 + p.phase) : 1;
      draw(ctx, p, (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3) * twinkle);
    }
    if (live.length) requestAnimationFrame(frame);
    else {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      fxRunning = false;
    }
  };
  requestAnimationFrame(frame);
}

interface BurstOptions {
  count?: number;
  /** Multiplies launch speed. */
  power?: number;
  /** Direction in radians; -π/2 is straight up. */
  angle?: number;
  /** Cone width in radians; 2π is every direction. */
  spread?: number;
  /** Mix in plain confetti, for bigger celebrations. */
  party?: boolean;
}

export function burst(x: number, y: number, opts: BurstOptions = {}) {
  if (calm() || !layer()) return;
  const { count = 40, power = 1, angle = -Math.PI / 2, spread = Math.PI * 2, party = false } = opts;
  const { kind, colors } = themeFx();
  for (let i = 0; i < count; i++) {
    const k: Kind = party && kind !== 'confetti' && Math.random() < 0.45 ? 'confetti' : kind;
    const p = make(k, colors, x, y);
    const a = angle + (Math.random() - 0.5) * spread;
    const speed = rand(180, 520) * power;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.size *= k === 'spark' ? 1.3 : 1;
    p.life = rand(1.1, 2.1);
    p.gravity = k === 'spark' ? 180 : k === 'star' ? 260 : 420;
    p.drag = rand(1.6, 2.6);
    p.spin = rand(-8, 8);
    live.push(p);
  }
  run();
}

/** Particles falling from the top of the screen. */
export function rain(count = 120) {
  if (calm() || !layer()) return;
  const { kind, colors } = themeFx();
  for (let i = 0; i < count; i++) {
    const k: Kind = kind === 'spark' || kind === 'star' ? (Math.random() < 0.5 ? kind : 'confetti') : kind;
    const p = make(k, colors, rand(0, innerWidth), rand(-innerHeight * 0.5, -10));
    p.vx = rand(-60, 60);
    p.vy = rand(80, 260);
    p.size *= k === 'spark' ? 1.4 : 1.1;
    p.life = rand(2.6, 4.2);
    p.gravity = k === 'petal' ? 40 : 90;
    p.drag = 0.4;
    p.spin = rand(-5, 5);
    live.push(p);
  }
  run();
}
