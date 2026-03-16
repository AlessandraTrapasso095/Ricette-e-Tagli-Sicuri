drop policy if exists app_settings_read on public.app_settings;

create policy app_settings_admin_read
  on public.app_settings for select
  using (public.is_admin(auth.uid()));
