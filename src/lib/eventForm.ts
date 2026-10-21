import type { EventInput } from './queries';
import { str, bool, safeUrl } from './form';
import { isValidTimeZone, localInputToDate } from './time';
import { THEMES } from './themes';

export type EventFormResult = { data: Omit<EventInput, 'slug'> & { slug: string }; errors: string[] };

export function parseEventForm(form: FormData): EventFormResult {
  const errors: string[] = [];
  const timezone = str(form, 'timezone', 64) || 'UTC';
  if (!isValidTimeZone(timezone)) errors.push(`"${timezone}" isn't a time zone I recognize. Try something like America/Edmonton.`);
  const tz = isValidTimeZone(timezone) ? timezone : 'UTC';

  const title = str(form, 'title', 120);
  if (!title) errors.push('Give the event a name.');

  const startsAt = localInputToDate(str(form, 'starts_at', 20), tz);
  if (!startsAt) errors.push('Pick when the event starts.');

  const endsRaw = str(form, 'ends_at', 20);
  const endsAt = endsRaw ? localInputToDate(endsRaw, tz) : null;
  if (startsAt && endsAt && endsAt <= startsAt) errors.push('The end time needs to be after the start time.');

  const theme = str(form, 'theme', 20);

  return {
    data: {
      slug: str(form, 'slug', 60),
      title,
      host_name: str(form, 'host_name', 80),
      tagline: str(form, 'tagline', 200),
      starts_at: startsAt ?? new Date(),
      ends_at: endsAt,
      timezone: tz,
      venue: str(form, 'venue', 120),
      address: str(form, 'address', 300),
      map_url: safeUrl(form, 'map_url'),
      dress_code: str(form, 'dress_code', 120),
      details: str(form, 'details', 5000),
      theme: THEMES.some((t) => t.id === theme) ? theme : THEMES[0].id,
      host_sees_claims: bool(form, 'host_sees_claims'),
    },
    errors,
  };
}
