-- Local development seed: 3 sample New York salons (SPEC §7).
-- Runs only on `supabase db reset` against a local or test database — never in production.
-- All names, phones and photos are fictional placeholders.

do $$
declare
  owner_id uuid := '00000000-0000-4000-a000-000000000001';
  customer_id uuid := '00000000-0000-4000-a000-000000000002';
  lisa uuid := '10000000-0000-4000-a000-000000000001';
  crown uuid := '10000000-0000-4000-a000-000000000002';
  fade uuid := '10000000-0000-4000-a000-000000000003';
  biz record;
  d int;
begin
  -- Demo accounts (passwordless; sign in locally with the email code from Inbucket at http://localhost:54324).
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@hairday.test', now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (customer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer@hairday.test', now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now());

  update profiles set first_name = 'Demo', last_name = 'Owner' where id = owner_id;
  update profiles set first_name = 'Demo', last_name = 'Customer' where id = customer_id;

  insert into businesses (id, owner_id, name, type, description, phone, website, instagram,
    address_line1, city, state, zip, lat, lng, amenities, health_safety, payouts_enabled, is_published)
  values
    (lisa, owner_id, 'Lisa''s Salon', 'Hair salon',
     'Cuts, color and blowouts in a calm West Village studio.', '+12125550101', 'https://example.com/lisas', 'lisas.salon',
     '214 Bleecker St', 'New York', 'NY', '10012', 40.7295, -74.0028,
     '{Wi-Fi,"Card payments","Wheelchair accessible"}', '{"Sanitized tools","Masks on request"}', true, true),
    (crown, owner_id, 'Crown & Coil', 'Braiding salon',
     'Knotless braids, twists and natural hair care in Bed-Stuy.', '+17185550102', 'https://example.com/crown', 'crownandcoil.bk',
     '402 Tompkins Ave', 'Brooklyn', 'NY', '11216', 40.6862, -73.9441,
     '{Wi-Fi,"Snacks & drinks","Kid friendly"}', '{"Sanitized tools"}', true, true),
    (fade, owner_id, 'Harlem Fade Co.', 'Barbershop',
     'Fades, shape-ups and beard work. Walk-ins welcome.', '+12125550103', 'https://example.com/fade', 'harlemfade',
     '2290 Frederick Douglass Blvd', 'New York', 'NY', '10027', 40.8106, -73.9529,
     '{"Card payments","Walk-ins"}', '{"Sanitized tools"}', true, true);

  -- Hours: Lisa's Tue–Sat 10–19, Crown Mon–Sat 9–20, Fade daily 9–21 (weekday 0 = Sunday).
  for d in 2..6 loop insert into business_hours (business_id, weekday, opens_at, closes_at) values (lisa, d, '10:00', '19:00'); end loop;
  for d in 1..6 loop insert into business_hours (business_id, weekday, opens_at, closes_at) values (crown, d, '09:00', '20:00'); end loop;
  for d in 0..6 loop insert into business_hours (business_id, weekday, opens_at, closes_at) values (fade, d, '09:00', '21:00'); end loop;

  -- Services (prices in cents, durations in 15-minute steps).
  insert into services (business_id, category_id, name, description, price_cents, duration_min, sort_order)
  select lisa, c.id, s.name, s.descr, s.price, s.mins, s.ord
  from (values
    ('haircut', 'Adult cut', 'Consultation, wash, cut and style.', 8500, 60, 1),
    ('haircut', 'Blowout', 'Wash and blow-dry.', 6000, 45, 2),
    ('color', 'Single-process color', 'All-over color, root to tip.', 14000, 120, 3),
    ('hair-treatments', 'Gloss treatment', 'Adds shine and tone.', 5500, 30, 4)
  ) as s(cat, name, descr, price, mins, ord) join categories c on c.slug = s.cat;

  insert into services (business_id, category_id, name, description, price_cents, duration_min, sort_order)
  select crown, c.id, s.name, s.descr, s.price, s.mins, s.ord
  from (values
    ('braids', 'Knotless braids, medium', 'Mid-back length. Hair included.', 22000, 300, 1),
    ('braids', 'Stitch cornrows', 'Up to 8 rows.', 9000, 90, 2),
    ('hair-treatments', 'Wash & deep condition', 'For natural hair.', 6500, 60, 3),
    ('kids-haircut', 'Kids braids', 'Ages 4–12.', 8000, 120, 4)
  ) as s(cat, name, descr, price, mins, ord) join categories c on c.slug = s.cat;

  insert into services (business_id, category_id, name, description, price_cents, duration_min, sort_order)
  select fade, c.id, s.name, s.descr, s.price, s.mins, s.ord
  from (values
    ('barber', 'Skin fade', 'Fade with a sharp line-up.', 4500, 45, 1),
    ('barber', 'Beard trim & shape-up', 'Hot towel included.', 2500, 30, 2),
    ('kids-haircut', 'Kids cut', 'Ages 12 and under.', 3000, 30, 3),
    ('barber', 'Cut + beard', 'Full service.', 6500, 60, 4)
  ) as s(cat, name, descr, price, mins, ord) join categories c on c.slug = s.cat;

  -- Professionals: each offers every service of their salon, and works the salon's hours.
  insert into professionals (business_id, role, first_name, last_name, instagram) values
    (lisa, 'hair stylist', 'April', 'Moreno', 'april.cuts'),
    (lisa, 'colorist', 'Jun', 'Park', null),
    (crown, 'braider', 'Amara', 'Okafor', 'amara.braids'),
    (crown, 'braider', 'Keisha', 'Brown', null),
    (fade, 'barber', 'Marcus', 'Reed', 'marcusfades'),
    (fade, 'barber', 'Luis', 'Vega', null);

  insert into professional_services (professional_id, service_id)
  select p.id, s.id from professionals p join services s on s.business_id = p.business_id;

  insert into availability (professional_id, weekday, starts_at, ends_at)
  select p.id, h.weekday, h.opens_at, h.closes_at
  from professionals p join business_hours h on h.business_id = p.business_id;

  -- A daily lunch break for everyone.
  insert into breaks (professional_id, weekday, starts_at, ends_at)
  select id, null, '13:00', '13:30' from professionals;

  -- Photo placeholders (replaced with real Storage uploads in Phase 2).
  for biz in select id from businesses loop
    insert into business_photos (business_id, url, sort_order) values
      (biz.id, 'https://placehold.co/1200x800/CBBFB2/171826?text=Salon', 0),
      (biz.id, 'https://placehold.co/1200x800/CBBFB2/171826?text=Interior', 1),
      (biz.id, 'https://placehold.co/1200x800/CBBFB2/171826?text=Work', 2);
  end loop;
end $$;
