create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  email text,
  google_provider_id text unique,
  kakao_provider_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_contact_or_provider_check check (
    contact is not null
    or email is not null
    or google_provider_id is not null
    or kakao_provider_id is not null
  )
);

create unique index if not exists users_contact_unique_idx on users (contact) where contact is not null;
create unique index if not exists users_email_unique_idx on users (lower(email)) where email is not null;

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_token_hash text not null unique,
  provider text not null default 'local',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists auth_sessions_user_id_idx on auth_sessions (user_id);
create index if not exists auth_sessions_expires_at_idx on auth_sessions (expires_at);
