create table if not exists brand_assets (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  brand_id text not null,
  section_id text not null,
  product_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists brand_assets_user_brand_id_idx on brand_assets (user_id, brand_id);
create index if not exists brand_assets_user_updated_at_idx on brand_assets (user_id, updated_at desc);
