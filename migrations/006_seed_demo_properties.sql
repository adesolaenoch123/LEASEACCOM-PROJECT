do $seed$
declare
  seed_owner_id uuid;
  seed_owner_name text;
  seed_owner_count bigint;
begin
  select
    count(*),
    (array_agg(id))[1],
    (array_agg(nullif(btrim(full_name), '')))[1]
    into seed_owner_count, seed_owner_id, seed_owner_name
  from public.profiles
  where account_type = 'owner';

  if seed_owner_count <> 1 then
    raise exception 'Expected exactly one owner profile, found %', seed_owner_count;
  end if;

  insert into public.properties (
    id, owner_id, title, type, location, city, price, period,
    service_charge, caution_fee, agency_fee, description,
    bedrooms, bathrooms, owner_name, image, cover_image, images,
    verification_status
  ) values
    (
      'demo-seed-001', seed_owner_id, 'Modern 2 Bedroom Apartment', 'Apartment',
      'Lekki Phase 1, Lagos', 'Lagos', 2800000, 'year',
      150000, 280000, 0,
      'Bright 2-bedroom apartment in Lekki Phase 1 with reliable power backup, fitted kitchen, and secured estate access. Ideal for professionals who want a clear, transparent rental process on LeaseAccom.',
      2, 2, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=80',
      '["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-002', seed_owner_id, 'Luxury 4 Bedroom Duplex', 'Duplex',
      'Gwarinpa, Abuja', 'Abuja', 6500000, 'year',
      300000, 650000, 0,
      'Spacious 4-bedroom duplex in Gwarinpa with compound parking, all-ensuite rooms, and a quiet street. Listed with full cost breakdown so tenants know what to budget before viewing.',
      4, 4, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',
      '["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-003', seed_owner_id, 'Furnished Executive Apartment', 'Apartment',
      'Victoria Island, Lagos', 'Lagos', 450000, 'month',
      null, null, null, '', 2, 2, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80',
      '["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-004', seed_owner_id, 'Cozy 1 Bedroom Shortlet', 'Shortlet',
      'Yaba, Lagos', 'Lagos', 85000, 'night',
      null, null, null, '', 1, 1, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
      '["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-005', seed_owner_id, 'Modern Office Space', 'Office',
      'Ikeja GRA, Lagos', 'Lagos', 3500000, 'year',
      null, null, null, '', 0, 2, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=80',
      '["https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-006', seed_owner_id, 'Spacious Family House', 'House',
      'Port Harcourt, Rivers', 'Port Harcourt', 3200000, 'year',
      null, null, null, '', 3, 3, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80',
      '["https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-007', seed_owner_id, 'Student Residence near University of Lagos', 'Student Housing',
      'Yaba, Lagos', 'Lagos', 350000, 'year',
      null, null, null, '', 1, 1, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85',
      '["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-008', seed_owner_id, 'Modern Student Hostel, Nsukka', 'Student Housing',
      'Nsukka, Enugu', 'Nsukka', 280000, 'year',
      null, null, null, '', 1, 1, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=85',
      '["https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-009', seed_owner_id, 'Executive Hotel Room in Victoria Island', 'Hotel',
      'Victoria Island, Lagos', 'Lagos', 145000, 'night',
      null, null, null, '', 1, 1, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85',
      '["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-010', seed_owner_id, 'Boutique Lodge near Wuse 2', 'Hotel',
      'Wuse 2, Abuja', 'Abuja', 95000, 'night',
      null, null, null, '', 1, 1, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=85',
      '["https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-011', seed_owner_id, 'Furnished Commercial Office, Ikeja', 'Office',
      'Ikeja GRA, Lagos', 'Ikeja', 4500000, 'year',
      null, null, null, '', 0, 0, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=85',
      '["https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    ),
    (
      'demo-seed-012', seed_owner_id, 'Street-Facing Retail Shop, Lekki', 'Shop',
      'Lekki Phase 1, Lagos', 'Lekki', 2800000, 'year',
      null, null, null, '', 0, 0, coalesce(seed_owner_name, 'Demo Owner'),
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85',
      '["https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85","https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85"]'::jsonb,
      'pending'
    )
  on conflict (id) do nothing;
end;
$seed$;