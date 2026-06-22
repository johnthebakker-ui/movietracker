update public.media
set
  collection_tmdb_id = nullif(raw->'belongs_to_collection'->>'id', '')::bigint,
  collection_name = nullif(raw->'belongs_to_collection'->>'name', ''),
  collection_poster_path = nullif(raw->'belongs_to_collection'->>'poster_path', '')
where kind = 'movie'
  and collection_tmdb_id is null
  and jsonb_typeof(raw->'belongs_to_collection') = 'object';
