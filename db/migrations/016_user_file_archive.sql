create table if not exists user_file_archive_files (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  uploaded_file_id text not null references uploaded_files(id) on delete cascade,
  original_name text not null,
  display_name text not null,
  note text not null default '',
  content_type text not null,
  size bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_file_archive_files_id_not_empty_check check (length(btrim(id)) > 0),
  constraint user_file_archive_files_original_name_not_empty_check check (length(btrim(original_name)) > 0),
  constraint user_file_archive_files_display_name_not_empty_check check (length(btrim(display_name)) > 0),
  constraint user_file_archive_files_content_type_not_empty_check check (length(btrim(content_type)) > 0),
  constraint user_file_archive_files_size_positive_check check (size > 0)
);

create index if not exists user_file_archive_files_user_created_at_idx on user_file_archive_files (user_id, created_at desc);
create index if not exists user_file_archive_files_uploaded_file_id_idx on user_file_archive_files (uploaded_file_id);
