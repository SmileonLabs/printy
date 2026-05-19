create table if not exists ai_business_card_mockups (
  user_id uuid not null references users(id) on delete cascade,
  signature text not null,
  mockups jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, signature),
  constraint ai_business_card_mockups_signature_not_empty_check check (length(btrim(signature)) > 0),
  constraint ai_business_card_mockups_mockups_array_check check (jsonb_typeof(mockups) = 'array')
);

create index if not exists ai_business_card_mockups_user_updated_at_idx on ai_business_card_mockups (user_id, updated_at desc);
