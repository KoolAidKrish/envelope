import type { APIRoute } from 'astro';
import { getEventBySlug } from '../../../lib/queries';
import { currentGuest } from '../../../lib/session';

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
}

/** Lines longer than 75 octets must be folded (RFC 5545). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

export const GET: APIRoute = async ({ params, cookies, redirect, url }) => {
  const event = await getEventBySlug(params.slug ?? '');
  const guest = event ? await currentGuest(cookies, event) : null;
  if (!event || !guest) return redirect(`/e/${params.slug}`);

  const end = event.ends_at ?? new Date(event.starts_at.getTime() + 3 * 3600e3);
  const location = [event.venue, event.address.replace(/\n/g, ', ')].filter(Boolean).join(', ');
  const link = `${url.origin}/i/${guest.invite_token}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Envelope//Invitations//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@envelope`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(event.starts_at)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(event.title)}`,
    location && `LOCATION:${icsText(location)}`,
    `DESCRIPTION:${icsText([event.tagline, `Your invitation: ${link}`].filter(Boolean).join('\n\n'))}`,
    `URL:${link}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean) as string[];

  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
};
