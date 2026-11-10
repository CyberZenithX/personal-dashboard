-- Daylog schema. Idempotent: safe to run on every build.

create table if not exists settings (
  id   int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

create table if not exists tasks (
  id         bigserial primary key,
  title      text not null,
  tag        text,
  due_date   date,
  due_time   text,
  prio       text not null default 'low',
  xp         int  not null default 10,
  sub        text,
  done       boolean not null default false,
  done_at    timestamptz,
  source     text not null default 'typed',
  created_at timestamptz not null default now()
);
create index if not exists tasks_due_idx on tasks (due_date);

create table if not exists notes (
  id         bigserial primary key,
  title      text not null,
  body       text not null default '',
  tag        text,
  source     text not null default 'typed',
  links      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_created_idx on notes (created_at desc);

create table if not exists events (
  id          bigserial primary key,
  title       text not null,
  kind        text not null default 'event',
  date        date not null,
  start_min   int  not null,
  end_min     int  not null,
  repeat_days int[],
  source      text not null default 'typed',
  created_at  timestamptz not null default now()
);
create index if not exists events_date_idx on events (date);

create table if not exists voice_logs (
  id         bigserial primary key,
  transcript text not null,
  item_count int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists xp_log (
  id      bigserial primary key,
  kind    text not null,
  amount  int  not null,
  label   text,
  ref     text,
  checkin boolean not null default false,
  day     date not null,
  at      timestamptz not null default now()
);
create unique index if not exists xp_log_ref_uq on xp_log (ref) where ref is not null;
create index if not exists xp_log_day_idx on xp_log (day);

-- Failed login attempts, for rate limiting the password form.
create table if not exists login_attempts (
  id bigserial primary key,
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_ip_idx on login_attempts (ip, at);
