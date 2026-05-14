create table if not exists brand_mockup_templates (
  id text primary key,
  title text not null,
  description text not null,
  image_url text not null,
  content_type text not null,
  size integer not null,
  placement jsonb not null,
  status text not null default 'draft',
  uploaded_file_id text references uploaded_files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_mockup_templates_title_not_empty_check check (length(btrim(title)) > 0),
  constraint brand_mockup_templates_description_not_empty_check check (length(btrim(description)) > 0),
  constraint brand_mockup_templates_image_url_not_empty_check check (length(btrim(image_url)) > 0),
  constraint brand_mockup_templates_content_type_check check (content_type in ('image/png', 'image/jpeg')),
  constraint brand_mockup_templates_size_positive_check check (size > 0),
  constraint brand_mockup_templates_status_check check (status in ('draft', 'published'))
);

create index if not exists brand_mockup_templates_status_updated_at_idx on brand_mockup_templates (status, updated_at desc);
