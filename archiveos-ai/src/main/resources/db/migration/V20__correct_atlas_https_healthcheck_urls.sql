-- V19 moved the platform URL. Use a literal replacement for the existing
-- managed-service rows so every Atlas probe reaches the verified HTTPS edge.
update public.managed_services
   set healthcheck_url = replace(healthcheck_url, 'http://161.33.17.84', 'https://161.33.17.84'),
       updated_at = now()
 where system_id = 'atlas-platform'
   and healthcheck_url like 'http://161.33.17.84/%';
