# Envelope

**Private invitations for the things you host. No accounts, no passwords, just a question only your guest can answer.**

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/KoolAidKrish/envelope)

Group chats are where event details go to die. Someone asks "wait, what time?" for the fourth time, the address is buried under 200 memes, and nobody knows who's actually coming.

Envelope gives every guest their own invitation. They open the private link you sent them and answer a question you wrote just for them ("What did we name the class hamster?"). Get it right and the envelope opens on everything they need:

- **When and where**, with a map link and an add-to-calendar button
- **An RSVP**, with plus-ones if you allow them and a spot for "I'm vegetarian" notes
- **What to bring**, for everyone or for one specific person (yes, Sam, *you're* on ice duty)
- **A gift registry** where guests claim items so nobody shows up with the same blender. Claims can be hidden from you, so gifts stay a surprise.
- **Questions for you**, either private or shared with the whole guest list
- **A personal note** from you that only they see

You run everything from `/admin`: create events, add guests one at a time or paste a whole list, see who's coming, answer questions, and preview any guest's invitation exactly as they see it. Four themes ship in the box: Midnight, Garden, Confetti, and Ember.

## Run your own in about 10 minutes

You need a free [Supabase](https://supabase.com) account (the database) and a free [Netlify](https://netlify.com) account (the hosting). That's it.

### 1. Make a database

1. In Supabase, create a new project. Save the database password somewhere; you'll need it in a second.
2. Go to **Project Settings > Database > Connection string** and pick **Transaction pooler** (it uses port `6543`).
3. Copy that string and replace `[YOUR-PASSWORD]` with your database password.

You don't need to create any tables. Envelope sets them up itself the first time it runs. (If you'd rather see it happen, paste `db/schema.sql` into Supabase's SQL editor.)

### 2. Deploy

Click the **Deploy to Netlify** button above. It copies this repo to your GitHub and asks for three settings:

| Setting | What to put |
| --- | --- |
| `DATABASE_URL` | The connection string from step 1 |
| `ADMIN_PASSWORD` | The password you'll use at `/admin`. Make it long. |
| `SESSION_SECRET` | Any random string, 32+ characters. Mash the keyboard, or run `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |

Deploying another way? Connect the repo in Netlify yourself and add the same three variables under **Site configuration > Environment variables**. Netlify reads everything else from `netlify.toml`.

### 3. Host something

Open `https://your-site.netlify.app/admin`, sign in, and create an event. Add guests, then hit **Copy invite** next to each one. That copies a ready-to-send message with that guest's private link. Send each one only to its guest.

### 4. Use your own domain (optional)

In Netlify, go to **Domain management > Add a domain**. A subdomain like `party.yourdomain.com` works nicely and leaves the rest of your domain alone.

## How sign-in works

Every guest gets a private link, `/i/<token>`, where the token is 122 random bits. The link picks the guest; the answer to their question signs them in. Two things are needed, and a stranger has neither.

- **Nothing to guess from outside.** The shared event address (`/e/<event>`) takes no names and shows nothing about the event, so nobody can test names to learn who's invited.
- **Answers aren't stored.** Only a scrypt hash is, so even you can't read them back. Forgot one? Set a new answer in the guest's Edit panel.
- **Typing is forgiving.** "Professor Nibbles!" and "professor nibbles" are the same answer.
- **Guessing is slow.** Five wrong answers locks that guest out for 15 minutes. You can unlock them from the guest list.
- **Leaked links can be cancelled.** **New link** on the guest list replaces a guest's link. The old one stops working and anyone signed in with it is signed out.
- **Sessions are signed cookies.** They're HTTP-only, so page scripts can't read them, and they last 60 days for guests and 7 for you.
- **The database is closed to the public.** Tables live in their own `envelope` schema with row level security on, so Supabase's public API can't touch them. Only the server, with your connection string, can.

The honest caveat: if a guest forwards their link, the question is the only lock left. "What's my favourite colour?" is guessable. "What did I spill on your couch in 2019?" is not.

## Making it yours

Envelope is a normal [Astro](https://astro.build) site, so it's easy to bend:

```
src/
  pages/
    i/[token].astro    a guest's private sign-in link
    e/[slug]/          the guest's invitation and calendar file
    admin/             the host side
  components/admin/    one file per admin tab
  lib/
    queries.ts         every database query lives here
    auth.ts            answer hashing and session cookies
    themes.ts          theme list (colours are in styles/guest.css)
  styles/
    guest.css          the invitation, the envelope, all four themes
    admin.css          the dashboard
db/schema.sql          tables, safe to re-run
```

**New theme:** add an entry to `THEMES` in `src/lib/themes.ts` and a matching `[data-theme='yours']` block in `src/styles/guest.css`. It shows up in the admin theme picker automatically.

### Running it locally

```sh
npm install
cp .env.example .env    # fill in the three settings
npm run dev             # http://localhost:4321/admin
```

Any Postgres database works locally, not just Supabase.

## License

MIT. Throw better parties.
