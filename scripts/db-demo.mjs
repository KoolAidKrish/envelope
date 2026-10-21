// Creates (or resets) a demo event for trying the guest experience locally.
// Usage: npm run db:demo            -> Midnight theme
//        npm run db:demo -- garden  -> any theme id
// Then open /e/demo-party and sign in as "Alex Demo", answer "pancakes".
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import postgres from 'postgres';

const scrypt = promisify(scryptCb);
const SLUG = 'demo-party';
const theme = process.argv[2] ?? 'midnight';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL first.');
  process.exit(1);
}
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : 'require', onnotice: () => {} });

// Same format as hashAnswer() in src/lib/auth.ts (fine for one-word lowercase answers).
async function hashAnswer(answer) {
  const salt = randomBytes(16);
  const hash = await scrypt(answer.toLowerCase().trim(), salt, 32);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

const startsAt = new Date(Date.now() + 9 * 864e5);
startsAt.setUTCHours(2, 0, 0, 0); // evening in the Americas

await sql`delete from envelope.events where slug = ${SLUG}`;
const [event] = await sql`
  insert into envelope.events (slug, title, host_name, tagline, starts_at, ends_at, timezone, venue, address, dress_code, details, theme)
  values (${SLUG}, 'Rooftop Supper Club', 'Jordan', 'Long tables, string lights, too much pasta.',
    ${startsAt}, ${new Date(startsAt.getTime() + 4 * 36e5)}, 'America/Edmonton',
    'The Glasshouse Roof', '123 Example Street\nSomewhere, AB', 'Cozy layers, it gets breezy up there',
    'Doors at 7. Dinner at 7:30, speeches never.\nTake the freight elevator to the top floor.', ${theme})
  returning id`;

const [alex] = await sql`
  insert into envelope.guests (event_id, name, name_key, question, answer_hash, note, max_plus_ones)
  values (${event.id}, 'Alex Demo', 'alex demo', 'What did we eat at 3am after the concert?',
    ${await hashAnswer('pancakes')}, 'Save me a seat by the heater. It would not be the same without you.', 2)
  returning id`;
const [sam] = await sql`
  insert into envelope.guests (event_id, name, name_key, question, answer_hash, rsvp)
  values (${event.id}, 'Sam Sample', 'sam sample', 'Favourite colour?', ${await hashAnswer('green')}, 'yes')
  returning id`;

await sql`insert into envelope.bring_items (event_id, guest_id, label) values
  (${event.id}, ${alex.id}, 'A bag of ice (you volunteered)'),
  (${event.id}, null, 'A warm layer'),
  (${event.id}, null, 'Your appetite'),
  (${event.id}, null, 'A song request for the playlist')`;

const items = await sql`insert into envelope.registry_items (event_id, title, price, note, quantity) values
  (${event.id}, 'Really good olive oil', '$25', '', 1),
  (${event.id}, 'Linen napkins', '$40', 'Any colour', 2),
  (${event.id}, 'Pasta maker', '$90', '', 1)
  returning id`;
await sql`insert into envelope.registry_claims (item_id, guest_id) values (${items[2].id}, ${sam.id})`;

await sql`insert into envelope.posts (event_id, guest_id, body, is_public, reply, replied_at) values
  (${event.id}, ${sam.id}, 'Is there parking nearby?', true, 'Street parking after 6 is free. Or bike, there''s a rack.', now())`;

await sql.end();
console.log(`Demo ready (${theme}): /e/${SLUG}  name "Alex Demo", answer "pancakes"`);
