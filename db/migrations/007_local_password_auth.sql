alter table users
  add column if not exists password_hash text;

alter table users
  drop constraint if exists users_password_hash_not_empty_check;

alter table users
  add constraint users_password_hash_not_empty_check
  check (password_hash is null or length(btrim(password_hash)) > 0);
