-- Attach existing reviews to the user's matching canonical rating.
update public.reviews review
set rating_id = rating.id,
    updated_at = now()
from public.ratings rating
where review.rating_id is null
  and review.user_id = rating.user_id
  and (
    (review.media_id is not null and rating.media_id = review.media_id)
    or (review.season_id is not null and rating.season_id = review.season_id)
    or (review.episode_id is not null and rating.episode_id = review.episode_id)
  );
