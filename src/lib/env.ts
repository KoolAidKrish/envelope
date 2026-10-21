// Server-only settings. On Netlify these come from process.env at request time;
// `astro dev` reads them from .env through import.meta.env.
function devFallback(name: string): string | undefined {
  try {
    if (name === 'DATABASE_URL') return import.meta.env.DATABASE_URL;
    if (name === 'ADMIN_PASSWORD') return import.meta.env.ADMIN_PASSWORD;
    if (name === 'SESSION_SECRET') return import.meta.env.SESSION_SECRET;
  } catch {
    // Outside Vite (plain Node scripts) import.meta.env doesn't exist.
  }
  return undefined;
}

export function env(name: 'DATABASE_URL' | 'ADMIN_PASSWORD' | 'SESSION_SECRET'): string {
  const value = process.env[name] || devFallback(name);
  if (!value) {
    throw new Error(`${name} is not set. Add it in Netlify under Site configuration > Environment variables.`);
  }
  return value;
}
