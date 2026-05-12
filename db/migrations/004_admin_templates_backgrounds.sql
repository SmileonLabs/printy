create table if not exists business_card_templates (
  id text primary key,
  product_id text not null,
  title text not null,
  summary text not null,
  tags jsonb not null default '[]'::jsonb,
  orientation text not null,
  preview_variant text,
  status text not null,
  source text not null default 'admin',
  layout jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_card_templates_tags_array_check check (jsonb_typeof(tags) = 'array'),
  constraint business_card_templates_layout_object_check check (layout is null or jsonb_typeof(layout) = 'object')
);

create index if not exists business_card_templates_product_source_status_idx on business_card_templates (product_id, source, status);
create index if not exists business_card_templates_updated_at_idx on business_card_templates (updated_at desc);
create index if not exists business_card_templates_tags_gin_idx on business_card_templates using gin (tags);

create table if not exists business_card_backgrounds (
  id text primary key,
  name text not null,
  tags jsonb not null default '[]'::jsonb,
  image_url text not null unique,
  content_type text not null,
  size bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_card_backgrounds_tags_array_check check (jsonb_typeof(tags) = 'array'),
  constraint business_card_backgrounds_size_positive_check check (size > 0)
);

create index if not exists business_card_backgrounds_updated_at_idx on business_card_backgrounds (updated_at desc);
create index if not exists business_card_backgrounds_tags_gin_idx on business_card_backgrounds using gin (tags);
