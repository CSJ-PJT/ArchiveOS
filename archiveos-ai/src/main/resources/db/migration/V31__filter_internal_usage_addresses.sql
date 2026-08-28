delete from public.archiveos_usage_logs
where client_ip << inet '106.101.0.0/16'
   or client_ip << inet '172.0.0.0/8'
   or client_ip << inet '10.0.0.0/8'
   or client_ip << inet '192.168.0.0/16'
   or client_ip << inet '127.0.0.0/8'
   or client_ip << inet '100.64.0.0/10'
   or client_ip << inet '0.0.0.0/8'
   or client_ip << inet 'fc00::/7'
   or client_ip << inet 'fe80::/10'
   or client_ip = inet '::1';

delete from public.atlas_access_events
where client_ip << inet '106.101.0.0/16'
   or client_ip << inet '172.0.0.0/8'
   or client_ip << inet '10.0.0.0/8'
   or client_ip << inet '192.168.0.0/16'
   or client_ip << inet '127.0.0.0/8'
   or client_ip << inet '100.64.0.0/10'
   or client_ip << inet '0.0.0.0/8'
   or client_ip << inet 'fc00::/7'
   or client_ip << inet 'fe80::/10'
   or client_ip = inet '::1';

update public.audit_logs
   set metadata = metadata - 'clientIp' - 'userAgent'
 where metadata->>'clientIp' is not null
   and (metadata->>'clientIp') ~ '^[0-9a-fA-F:.]+$'
   and ((metadata->>'clientIp')::inet << inet '106.101.0.0/16'
     or (metadata->>'clientIp')::inet << inet '172.0.0.0/8'
     or (metadata->>'clientIp')::inet << inet '10.0.0.0/8'
     or (metadata->>'clientIp')::inet << inet '192.168.0.0/16'
     or (metadata->>'clientIp')::inet << inet '127.0.0.0/8'
     or (metadata->>'clientIp')::inet << inet '100.64.0.0/10'
     or (metadata->>'clientIp')::inet << inet '0.0.0.0/8'
     or (metadata->>'clientIp')::inet << inet 'fc00::/7'
     or (metadata->>'clientIp')::inet << inet 'fe80::/10'
     or (metadata->>'clientIp')::inet = inet '::1');
