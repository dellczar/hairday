-- Phase 2 — Owner setup.
-- 1. A public "photos" storage bucket for logos, salon photos, team avatars and portfolios.
--    Files live under <business_id>/…; only that business's owner can add, change or delete them.
-- 2. Owners can no longer set payout fields themselves: payouts_enabled and stripe_account_id
--    are written only by the Stripe webhook (service role), so a salon can't publish itself
--    without finishing Stripe onboarding.

-- ─────────────────────────────────────────────────────────── photo storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- True when the first folder of a storage path is a business the signed-in user owns.
create function public.owns_photo_path(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when split_part(path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then is_business_owner(split_part(path, '/', 1)::uuid)
    else false
  end;
$$;

create policy "photos: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.owns_photo_path(name));
create policy "photos: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.owns_photo_path(name))
  with check (bucket_id = 'photos' and public.owns_photo_path(name));
create policy "photos: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.owns_photo_path(name));
-- No select policy needed: the bucket is public, so photos load by URL for everyone.

-- ─────────────────────────────────────────────────────────── payout fields are server-only
revoke insert, update on businesses from anon, authenticated;
grant insert (
  owner_id, name, type, description, phone, website, instagram, tiktok,
  address_line1, address_line2, city, state, zip, lat, lng, time_zone, logo_url,
  amenities, health_safety, cancellation_hours, late_cancel_percent, is_published
) on businesses to authenticated;
grant update (
  name, type, description, phone, website, instagram, tiktok,
  address_line1, address_line2, city, state, zip, lat, lng, time_zone, logo_url,
  amenities, health_safety, cancellation_hours, late_cancel_percent, is_published
) on businesses to authenticated;
