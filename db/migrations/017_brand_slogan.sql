alter table brands
  add column if not exists slogan text not null default '';
