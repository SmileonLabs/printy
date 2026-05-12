create table if not exists brands (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  name text not null,
  category text not null,
  design_request text not null,
  selected_logo_id text not null,
  members jsonb not null default '[]'::jsonb,
  assets integer not null default 0,
  created_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists brands_user_updated_at_idx on brands (user_id, updated_at desc);

create table if not exists generated_logos (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  brand_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists generated_logos_user_updated_at_idx on generated_logos (user_id, updated_at desc);
create index if not exists generated_logos_user_brand_id_idx on generated_logos (user_id, brand_id) where brand_id is not null;

create table if not exists business_card_drafts (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  brand_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists business_card_drafts_user_updated_at_idx on business_card_drafts (user_id, updated_at desc);
create index if not exists business_card_drafts_user_brand_id_idx on business_card_drafts (user_id, brand_id) where brand_id is not null;
