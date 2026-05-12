create table if not exists uploaded_file_blobs (
  uploaded_file_id text primary key references uploaded_files (id) on delete cascade,
  bytes bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
