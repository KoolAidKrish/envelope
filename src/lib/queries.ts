import { db } from './db';
import { nameKey } from './auth';

// ---------- Types ----------

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  host_name: string;
  tagline: string;
  starts_at: Date;
  ends_at: Date | null;
  timezone: string;
  venue: string;
  address: string;
  map_url: string;
  dress_code: string;
  details: string;
  theme: string;
  host_sees_claims: boolean;
  created_at: Date;
};

export type EventInput = Omit<EventRow, 'id' | 'created_at'>;

export type Rsvp = 'pending' | 'yes' | 'maybe' | 'no';

export type GuestRow = {
  id: string;
  event_id: string;
  name: string;
  question: string;
  answer_hash: string;
  note: string;
  max_plus_ones: number;
  rsvp: Rsvp;
  plus_ones: number;
  rsvp_note: string;
  rsvp_at: Date | null;
  failed_attempts: number;
  locked_until: Date | null;
  last_seen_at: Date | null;
  invite_token: string;
  created_at: Date;
};

export type BringRow = { id: string; label: string; guest_id: string | null; guest_name: string | null };

export type RegistryRow = {
  id: string;
  title: string;
  url: string;
  price: string;
  note: string;
  quantity: number;
  claimed: number;
  mine: boolean;
  claimers: string[];
};

export type PostRow = {
  id: string;
  guest_id: string;
  guest_name: string;
  body: string;
  is_public: boolean;
  reply: string;
  replied_at: Date | null;
  created_at: Date;
};

// ---------- Events ----------

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const sql = await db();
  const [row] = await sql<EventRow[]>`select * from envelope.events where slug = ${slug}`;
  return row ?? null;
}

export async function getEventById(id: string): Promise<EventRow | null> {
  if (!isUuid(id)) return null;
  const sql = await db();
  const [row] = await sql<EventRow[]>`select * from envelope.events where id = ${id}`;
  return row ?? null;
}

export type EventSummary = EventRow & {
  invited: number;
  going: number;
  headcount: number;
  pending: number;
  unanswered: number;
};

export async function listEvents(): Promise<EventSummary[]> {
  const sql = await db();
  return sql<EventSummary[]>`
    select e.*,
      (select count(*)::int from envelope.guests g where g.event_id = e.id) as invited,
      (select count(*)::int from envelope.guests g where g.event_id = e.id and g.rsvp = 'yes') as going,
      (select coalesce(sum(1 + g.plus_ones), 0)::int from envelope.guests g where g.event_id = e.id and g.rsvp = 'yes') as headcount,
      (select count(*)::int from envelope.guests g where g.event_id = e.id and g.rsvp = 'pending') as pending,
      (select count(*)::int from envelope.posts p where p.event_id = e.id and p.reply = '') as unanswered
    from envelope.events e
    order by (e.starts_at < now() - interval '1 day'), abs(extract(epoch from (e.starts_at - now())))`;
}

export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'event'
  );
}

export async function uniqueSlug(wanted: string, excludeId?: string): Promise<string> {
  const sql = await db();
  const base = slugify(wanted);
  const taken = new Set(
    (
      await sql<{ slug: string }[]>`
        select slug from envelope.events
        where (slug = ${base} or slug like ${base + '-%'}) and id is distinct from ${excludeId ?? null}::uuid`
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function createEvent(input: EventInput): Promise<EventRow> {
  const sql = await db();
  const [row] = await sql<EventRow[]>`insert into envelope.events ${sql(input)} returning *`;
  return row;
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<void> {
  const sql = await db();
  await sql`update envelope.events set ${sql(input)} where id = ${id}`;
}

export async function deleteEvent(id: string): Promise<void> {
  const sql = await db();
  await sql`delete from envelope.events where id = ${id}`;
}

export async function eventStats(eventId: string) {
  const sql = await db();
  const [s] = await sql<
    { invited: number; yes: number; maybe: number; no: number; pending: number; headcount: number; seen: number }[]
  >`
    select
      count(*)::int as invited,
      count(*) filter (where rsvp = 'yes')::int as yes,
      count(*) filter (where rsvp = 'maybe')::int as maybe,
      count(*) filter (where rsvp = 'no')::int as no,
      count(*) filter (where rsvp = 'pending')::int as pending,
      coalesce(sum(1 + plus_ones) filter (where rsvp = 'yes'), 0)::int as headcount,
      count(*) filter (where last_seen_at is not null)::int as seen
    from envelope.guests where event_id = ${eventId}`;
  return s;
}

// ---------- Guests ----------

/** Finds the guest a private invite link belongs to. */
export async function getGuestByToken(token: string): Promise<GuestRow | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const sql = await db();
  const [row] = await sql<GuestRow[]>`select * from envelope.guests where invite_token = ${token}`;
  return row ?? null;
}

/** Replaces a guest's invite link. The old link and its sessions stop working. */
export async function regenerateInviteToken(eventId: string, guestId: string): Promise<void> {
  const sql = await db();
  await sql`update envelope.guests set invite_token = replace(gen_random_uuid()::text, '-', ''),
      failed_attempts = 0, locked_until = null
    where id = ${guestId} and event_id = ${eventId}`;
}

export async function getGuest(id: string, eventId: string): Promise<GuestRow | null> {
  if (!isUuid(id)) return null;
  const sql = await db();
  const [row] = await sql<GuestRow[]>`select * from envelope.guests where id = ${id} and event_id = ${eventId}`;
  return row ?? null;
}

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export async function recordLoginFailure(guestId: string): Promise<boolean> {
  const sql = await db();
  const [row] = await sql<{ locked: boolean }[]>`
    update envelope.guests set
      failed_attempts = case when failed_attempts + 1 >= ${MAX_ATTEMPTS} then 0 else failed_attempts + 1 end,
      locked_until = case when failed_attempts + 1 >= ${MAX_ATTEMPTS}
        then now() + make_interval(mins => ${LOCK_MINUTES}) else locked_until end
    where id = ${guestId}
    returning (locked_until is not null and locked_until > now()) as locked`;
  return row?.locked ?? false;
}

export async function recordLoginSuccess(guestId: string): Promise<void> {
  const sql = await db();
  await sql`update envelope.guests set failed_attempts = 0, locked_until = null, last_seen_at = now() where id = ${guestId}`;
}

export async function touchGuest(guestId: string): Promise<void> {
  const sql = await db();
  await sql`update envelope.guests set last_seen_at = now()
    where id = ${guestId} and (last_seen_at is null or last_seen_at < now() - interval '10 minutes')`;
}

export async function listGuests(eventId: string): Promise<GuestRow[]> {
  const sql = await db();
  return sql<GuestRow[]>`select * from envelope.guests where event_id = ${eventId} order by lower(name)`;
}

export type GuestInput = { name: string; question: string; answerHash: string; note?: string; maxPlusOnes?: number };

export async function addGuest(eventId: string, g: GuestInput): Promise<'ok' | 'duplicate'> {
  const sql = await db();
  const rows = await sql`
    insert into envelope.guests (event_id, name, name_key, question, answer_hash, note, max_plus_ones)
    values (${eventId}, ${g.name.trim()}, ${nameKey(g.name)}, ${g.question.trim()}, ${g.answerHash},
            ${g.note?.trim() ?? ''}, ${g.maxPlusOnes ?? 0})
    on conflict (event_id, name_key) do nothing
    returning id`;
  return rows.length ? 'ok' : 'duplicate';
}

export async function updateGuest(
  eventId: string,
  guestId: string,
  g: { name: string; question: string; answerHash?: string; note: string; maxPlusOnes: number },
): Promise<'ok' | 'duplicate'> {
  const sql = await db();
  try {
    await sql`
      update envelope.guests set
        name = ${g.name.trim()}, name_key = ${nameKey(g.name)}, question = ${g.question.trim()},
        answer_hash = coalesce(${g.answerHash ?? null}, answer_hash),
        note = ${g.note.trim()}, max_plus_ones = ${g.maxPlusOnes},
        plus_ones = least(plus_ones, ${g.maxPlusOnes})
      where id = ${guestId} and event_id = ${eventId}`;
    return 'ok';
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return 'duplicate';
    throw err;
  }
}

export async function deleteGuest(eventId: string, guestId: string): Promise<void> {
  const sql = await db();
  await sql`delete from envelope.guests where id = ${guestId} and event_id = ${eventId}`;
}

export async function unlockGuest(eventId: string, guestId: string): Promise<void> {
  const sql = await db();
  await sql`update envelope.guests set failed_attempts = 0, locked_until = null where id = ${guestId} and event_id = ${eventId}`;
}

export async function setRsvp(guestId: string, rsvp: Rsvp, plusOnes: number, note: string): Promise<void> {
  const sql = await db();
  await sql`
    update envelope.guests set
      rsvp = ${rsvp},
      plus_ones = case when ${rsvp} = 'no' then 0 else least(greatest(${plusOnes}, 0), max_plus_ones) end,
      rsvp_note = ${note.trim().slice(0, 500)},
      rsvp_at = now()
    where id = ${guestId}`;
}

// ---------- What to bring ----------

export async function listBring(eventId: string): Promise<BringRow[]> {
  const sql = await db();
  return sql<BringRow[]>`
    select b.id, b.label, b.guest_id, g.name as guest_name
    from envelope.bring_items b left join envelope.guests g on g.id = b.guest_id
    where b.event_id = ${eventId}
    order by b.guest_id nulls first, lower(g.name), b.created_at`;
}

export async function listBringForGuest(eventId: string, guestId: string): Promise<BringRow[]> {
  const sql = await db();
  return sql<BringRow[]>`
    select id, label, guest_id, null as guest_name from envelope.bring_items
    where event_id = ${eventId} and (guest_id is null or guest_id = ${guestId})
    order by guest_id nulls first, created_at`;
}

export async function addBring(eventId: string, label: string, guestId: string | null): Promise<void> {
  const sql = await db();
  await sql`
    insert into envelope.bring_items (event_id, label, guest_id)
    select ${eventId}, ${label.trim()}, ${guestId}::uuid
    where ${guestId}::uuid is null
       or exists (select 1 from envelope.guests where id = ${guestId}::uuid and event_id = ${eventId})`;
}

export async function deleteBring(eventId: string, id: string): Promise<void> {
  const sql = await db();
  await sql`delete from envelope.bring_items where id = ${id} and event_id = ${eventId}`;
}

// ---------- Registry ----------

export async function listRegistry(eventId: string, viewerGuestId: string | null): Promise<RegistryRow[]> {
  const sql = await db();
  return sql<RegistryRow[]>`
    select r.id, r.title, r.url, r.price, r.note, r.quantity,
      count(c.id)::int as claimed,
      coalesce(bool_or(c.guest_id = ${viewerGuestId}::uuid), false) as mine,
      coalesce(array_agg(g.name order by c.created_at) filter (where g.name is not null), '{}') as claimers
    from envelope.registry_items r
    left join envelope.registry_claims c on c.item_id = r.id
    left join envelope.guests g on g.id = c.guest_id
    where r.event_id = ${eventId}
    group by r.id
    order by r.created_at`;
}

export type RegistryInput = { title: string; url: string; price: string; note: string; quantity: number };

export async function addRegistryItem(eventId: string, item: RegistryInput): Promise<void> {
  const sql = await db();
  await sql`insert into envelope.registry_items ${sql({ event_id: eventId, ...item })}`;
}

export async function updateRegistryItem(eventId: string, id: string, item: RegistryInput): Promise<void> {
  const sql = await db();
  await sql`update envelope.registry_items set ${sql(item)} where id = ${id} and event_id = ${eventId}`;
}

export async function deleteRegistryItem(eventId: string, id: string): Promise<void> {
  const sql = await db();
  await sql`delete from envelope.registry_items where id = ${id} and event_id = ${eventId}`;
}

/** Claims one of an item for a guest, if any are left. */
export async function claimItem(eventId: string, itemId: string, guestId: string): Promise<'ok' | 'gone'> {
  if (!isUuid(itemId)) return 'gone';
  const sql = await db();
  return sql.begin(async (tx) => {
    const [item] = await tx<{ quantity: number }[]>`
      select quantity from envelope.registry_items where id = ${itemId} and event_id = ${eventId} for update`;
    if (!item) return 'gone' as const;
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from envelope.registry_claims where item_id = ${itemId}`;
    if (n >= item.quantity) return 'gone' as const;
    await tx`insert into envelope.registry_claims (item_id, guest_id) values (${itemId}, ${guestId}) on conflict do nothing`;
    return 'ok' as const;
  });
}

export async function unclaimItem(itemId: string, guestId: string): Promise<void> {
  if (!isUuid(itemId)) return;
  const sql = await db();
  await sql`delete from envelope.registry_claims where item_id = ${itemId} and guest_id = ${guestId}`;
}

// ---------- Questions ----------

export async function listPostsForGuest(eventId: string, guestId: string): Promise<PostRow[]> {
  const sql = await db();
  return sql<PostRow[]>`
    select p.*, g.name as guest_name from envelope.posts p join envelope.guests g on g.id = p.guest_id
    where p.event_id = ${eventId} and (p.guest_id = ${guestId} or p.is_public)
    order by p.created_at desc limit 200`;
}

export async function listPosts(eventId: string): Promise<PostRow[]> {
  const sql = await db();
  return sql<PostRow[]>`
    select p.*, g.name as guest_name from envelope.posts p join envelope.guests g on g.id = p.guest_id
    where p.event_id = ${eventId}
    order by (p.reply = '') desc, p.created_at desc`;
}

export async function addPost(eventId: string, guestId: string, body: string, isPublic: boolean): Promise<void> {
  const sql = await db();
  await sql`insert into envelope.posts (event_id, guest_id, body, is_public)
    values (${eventId}, ${guestId}, ${body.trim().slice(0, 2000)}, ${isPublic})`;
}

/** Guests can take back a question until it's been answered. */
export async function deleteOwnPost(postId: string, guestId: string): Promise<void> {
  if (!isUuid(postId)) return;
  const sql = await db();
  await sql`delete from envelope.posts where id = ${postId} and guest_id = ${guestId} and reply = ''`;
}

export async function replyToPost(eventId: string, postId: string, reply: string): Promise<void> {
  const sql = await db();
  const text = reply.trim().slice(0, 4000);
  await sql`update envelope.posts set reply = ${text}, replied_at = ${text ? sql`now()` : null}
    where id = ${postId} and event_id = ${eventId}`;
}

export async function setPostPublic(eventId: string, postId: string, isPublic: boolean): Promise<void> {
  const sql = await db();
  await sql`update envelope.posts set is_public = ${isPublic} where id = ${postId} and event_id = ${eventId}`;
}

export async function deletePost(eventId: string, postId: string): Promise<void> {
  const sql = await db();
  await sql`delete from envelope.posts where id = ${postId} and event_id = ${eventId}`;
}

// ---------- Helpers ----------

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
