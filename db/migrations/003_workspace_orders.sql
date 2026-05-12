create table if not exists orders (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  brand_id text not null,
  card_draft_id text not null,
  template_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists orders_user_updated_at_idx on orders (user_id, updated_at desc);
create index if not exists orders_user_brand_id_idx on orders (user_id, brand_id);
create index if not exists orders_user_card_draft_id_idx on orders (user_id, card_draft_id);
create index if not exists orders_user_template_id_idx on orders (user_id, template_id) where template_id is not null;
