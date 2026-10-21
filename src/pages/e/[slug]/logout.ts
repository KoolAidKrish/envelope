import type { APIRoute } from 'astro';
import { clearGuestSession } from '../../../lib/auth';

export const POST: APIRoute = ({ params, cookies, redirect }) => {
  clearGuestSession(cookies);
  return redirect(`/e/${params.slug}`);
};
