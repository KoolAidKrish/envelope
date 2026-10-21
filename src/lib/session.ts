import type { AstroCookies } from 'astro';
import { getGuestSession, tokenTag } from './auth';
import { getGuest, type EventRow, type GuestRow } from './queries';

/**
 * The guest signed in to this event, or null. Checks the cookie's signature,
 * that it's for this event, that the guest still exists, and that their
 * invite link hasn't been replaced since they signed in.
 */
export async function currentGuest(cookies: AstroCookies, event: Pick<EventRow, 'id'>): Promise<GuestRow | null> {
  const session = getGuestSession(cookies);
  if (!session || session.eventId !== event.id || !session.tag) return null;
  const guest = await getGuest(session.guestId, event.id);
  if (!guest || tokenTag(guest.invite_token) !== session.tag) return null;
  return guest;
}
