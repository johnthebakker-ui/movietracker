-- Usernames are public handles and must be unique regardless of capitalization.
create unique index if not exists profiles_username_case_insensitive_unique
  on public.profiles (lower(username));
