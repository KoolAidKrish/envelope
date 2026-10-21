-- Envelope database schema.
-- Safe to run any number of times: the app runs it automatically on first use,
-- and you can also paste it into the Supabase SQL editor yourself.

select pg_advisory_xact_lock(81726354);

create schema if not exists envelope;

create table if not exists envelope.events (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  title                 text not null,
  host_name             text not null default '',
  tagline               text not null default '',
  starts_at             timestamptz not null,
  ends_at               timestamptz,
  timezone              text not null default 'UTC',
  venue                 text not null default '',
  address               text not null default '',
  map_url               text not null default '',
  dress_code            text not null default '',
  details               text not null default '',
  theme                 text not null default 'midnight',
  host_sees_claims      boolean not null default false,
  created_at            timestamptz not null default now()
);

create table if not exists envelope.guests (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references envelope.events(id) on delete cascade,
  name             text not null,
  name_key         text not null,
  question         text not null,
  answer_hash      text not null,
  note             text not null default '',
  max_plus_ones    integer not null default 0 check (max_plus_ones >= 0),
  rsvp             text not null default 'pending' check (rsvp in ('pending', 'yes', 'maybe', 'no')),
  plus_ones        integer not null default 0 check (plus_ones >= 0),
  rsvp_note        text not null default '',
  rsvp_at          timestamptz,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (event_id, name_key)
);

create table if not exists envelope.bring_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references envelope.events(id) on delete cascade,
  guest_id    uuid references envelope.guests(id) on delete cascade, -- null = everyone
  label       text not null,
  created_at  timestamptz not null default now()
);

create table if not exists envelope.registry_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references envelope.events(id) on delete cascade,
  title       text not null,
  url         text not null default '',
  price       text not null default '',
  note        text not null default '',
  quantity    integer not null default 1 check (quantity >= 1),
  created_at  timestamptz not null default now()
);

create table if not exists envelope.registry_claims (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references envelope.registry_items(id) on delete cascade,
  guest_id    uuid not null references envelope.guests(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (item_id, guest_id)
);

create table if not exists envelope.posts (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references envelope.events(id) on delete cascade,
  guest_id    uuid not null references envelope.guests(id) on delete cascade,
  body        text not null,
  is_public   boolean not null default false,
  reply       text not null default '',
  replied_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists guests_event_idx   on envelope.guests (event_id);
create index if not exists bring_event_idx    on envelope.bring_items (event_id);
create index if not exists registry_event_idx on envelope.registry_items (event_id);
create index if not exists claims_item_idx    on envelope.registry_claims (item_id);
create index if not exists posts_event_idx    on envelope.posts (event_id, created_at desc);

-- The app connects as the database owner, which bypasses row level security.
-- Enabling it with no policies blocks Supabase's public Data API from these tables.
alter table envelope.events          enable row level security;
alter table envelope.guests          enable row level security;
alter table envelope.bring_items     enable row level security;
alter table envelope.registry_items  enable row level security;
alter table envelope.registry_claims enable row level security;
alter table envelope.posts           enable row level security;
