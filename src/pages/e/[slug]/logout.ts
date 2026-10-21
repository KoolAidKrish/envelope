import type { APIRoute } from 'astro';
import { clearGuestSession } from '../../../lib/auth';
import { getEventBySlug } from '../../../lib/queries';
import { currentGuest } from '../../../lib/session';

// Sends the guest back to their own invite link so they can sign in again.
export const POST: APIRoute = async ({ params, cookies, redirect }) => {
  const event = await getEventBySlug(params.slug ?? '');
  const guest = event ? await currentGuest(cookies, event) : null;
  clearGuestSession(cookies);
  return redirect(guest ? `/i/${guest.invite_token}` : `/e/${params.slug}`);
};
