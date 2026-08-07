-- Atlas is an external, read-only integration.  The verified edge endpoint
-- redirects HTTP to HTTPS, so keep the configured public endpoint and every
-- healthcheck on HTTPS to avoid redirect-dependent status collection.
update public.managed_systems
   set public_base_url = 'https://161.33.17.84',
       updated_at = now()
 where system_id = 'atlas-platform';

update public.managed_services
   set healthcheck_url = regexp_replace(healthcheck_url, '^http://161\\.33\\.17\\.84', 'https://161.33.17.84'),
       updated_at = now()
 where system_id = 'atlas-platform'
   and healthcheck_url like 'http://161.33.17.84/%';
