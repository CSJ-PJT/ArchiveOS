delete from public.archiveos_usage_logs
where client_ip = inet '161.33.17.84';

delete from public.atlas_access_events
where client_ip = inet '161.33.17.84';

update public.audit_logs
   set metadata = metadata - 'clientIp' - 'userAgent'
 where metadata->>'clientIp' in ('161.33.17.84', '161.33.17.84/32');
