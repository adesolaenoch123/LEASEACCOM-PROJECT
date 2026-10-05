alter table public.properties
    add column if not exists images text[] not null default '{}';

update public.properties
set images = array[image]
where cardinality(images) = 0
  and image <> '';

notify pgrst, 'reload schema';
