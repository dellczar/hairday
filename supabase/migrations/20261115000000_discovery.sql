-- Phase 3: Discovery (SPEC §10 Home / Explore / Salon / Professional).
--
-- Customers need to read reviews with the reviewer's name ("Dana T."), but `profiles` is private
-- (each person reads only their own row). This view exposes just first name + last initial, and
-- only for published salons. It runs as its owner so it can read those two profile columns; the
-- where-clause is what keeps unpublished salons and every other profile column out.

create view public_reviews with (security_barrier = true) as
select
  r.id,
  r.business_id,
  r.professional_id,
  r.rating,
  r.tags,
  r.body,
  r.photo_url,
  r.created_at,
  coalesce(nullif(trim(p.first_name), ''), 'Hairday client')
    || coalesce(' ' || nullif(left(trim(p.last_name), 1), '') || '.', '') as reviewer_name
from reviews r
join businesses b on b.id = r.business_id and b.is_published
left join profiles p on p.id = r.customer_id;

revoke all on public_reviews from anon, authenticated;
grant select on public_reviews to anon, authenticated;

-- Faster "all published salons" and "reviews for this salon" reads.
create index if not exists businesses_published_idx on businesses (is_published) where is_published;
create index if not exists reviews_business_idx on reviews (business_id);
create index if not exists favorites_customer_idx on favorites (customer_id);
