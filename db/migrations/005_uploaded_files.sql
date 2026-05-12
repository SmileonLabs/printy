create table if not exists uploaded_files (
  id text primary key,
  bucket text not null,
  object_key text not null,
  public_url text not null unique,
  content_type text not null,
  size bigint not null,
  purpose text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uploaded_files_bucket_object_key_unique unique (bucket, object_key),
  constraint uploaded_files_bucket_not_empty_check check (length(btrim(bucket)) > 0),
  constraint uploaded_files_object_key_safe_check check (length(btrim(object_key)) > 0 and position('/' in object_key) = 0 and position('\\' in object_key) = 0 and object_key not like '%..%'),
  constraint uploaded_files_public_url_not_empty_check check (length(btrim(public_url)) > 0),
  constraint uploaded_files_content_type_not_empty_check check (length(btrim(content_type)) > 0),
  constraint uploaded_files_size_positive_check check (size > 0),
  constraint uploaded_files_purpose_not_empty_check check (length(btrim(purpose)) > 0)
);

create index if not exists uploaded_files_bucket_purpose_idx on uploaded_files (bucket, purpose);
create index if not exists uploaded_files_created_at_idx on uploaded_files (created_at desc);

alter table business_card_backgrounds
  add column if not exists uploaded_file_id text;

alter table business_card_backgrounds
  drop constraint if exists business_card_backgrounds_uploaded_file_id_fkey;

alter table business_card_backgrounds
  add constraint business_card_backgrounds_uploaded_file_id_fkey
  foreign key (uploaded_file_id) references uploaded_files (id) on delete set null;

create index if not exists business_card_backgrounds_uploaded_file_id_idx on business_card_backgrounds (uploaded_file_id);

insert into uploaded_files (id, bucket, object_key, public_url, content_type, size, purpose, created_at, updated_at)
select
  'uploaded-file-backfill-' || regexp_replace(background.id, '[^a-zA-Z0-9_-]', '-', 'g'),
  'admin-business-card-backgrounds',
  substring(background.image_url from '^/uploads/admin/business-card-backgrounds/([^/\\]+)$'),
  background.image_url,
  background.content_type,
  background.size,
  'business-card-background',
  background.created_at,
  background.updated_at
from business_card_backgrounds background
where background.image_url ~ '^/uploads/admin/business-card-backgrounds/[^/\\]+$'
  and substring(background.image_url from '^/uploads/admin/business-card-backgrounds/([^/\\]+)$') not like '%..%'
on conflict (public_url)
do update set
  content_type = excluded.content_type,
  size = excluded.size,
  purpose = excluded.purpose,
  updated_at = greatest(uploaded_files.updated_at, excluded.updated_at);

update business_card_backgrounds background
set uploaded_file_id = uploaded_files.id
from uploaded_files
where background.uploaded_file_id is null
  and background.image_url = uploaded_files.public_url;
