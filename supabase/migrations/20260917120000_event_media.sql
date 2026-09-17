-- Event cover photos. Public read (they are shown on the website), written only by the event's
-- organizers under events/<event_id>/..., images only, up to 5 MB each.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-media', 'event-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "event-media: organizer upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-media'
    and public.has_event_role(public.storage_event_id(name), array['organizer']::public.staff_role[])
  );

create policy "event-media: organizer replace" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'event-media'
    and public.has_event_role(public.storage_event_id(name), array['organizer']::public.staff_role[])
  );

create policy "event-media: organizer delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-media'
    and public.has_event_role(public.storage_event_id(name), array['organizer']::public.staff_role[])
  );

-- Only http(s) links or nothing: the cover is rendered as an image on public pages.
alter table public.events
  add constraint events_image_url_http check (image_url is null or image_url ~ '^https?://');
