create index if not exists ecosystem_flow_event_business_occurred_idx
  on public.ecosystem_flow_event (occurred_at desc, received_at desc, id desc)
  where not (
    lower(coalesce(event_type, '')) like '%heartbeat%' or
    lower(coalesce(event_type, '')) like '%health%' or
    lower(coalesce(event_type, '')) like '%availability%' or
    lower(coalesce(event_type, '')) like '%collector%' or
    lower(coalesce(event_type, '')) in ('service_unavailable', 'service_degraded') or
    lower(coalesce(event_type, '')) like '%system%' or
    lower(coalesce(metadata->>'eventCategory', '')) in ('heartbeat', 'health', 'availability', 'collector', 'system')
  );

create index if not exists ecosystem_flow_event_business_source_idx
  on public.ecosystem_flow_event (source_system_id, occurred_at desc, received_at desc, id desc)
  where not (
    lower(coalesce(event_type, '')) like '%heartbeat%' or
    lower(coalesce(event_type, '')) like '%health%' or
    lower(coalesce(event_type, '')) like '%availability%' or
    lower(coalesce(event_type, '')) like '%collector%' or
    lower(coalesce(event_type, '')) in ('service_unavailable', 'service_degraded') or
    lower(coalesce(event_type, '')) like '%system%' or
    lower(coalesce(metadata->>'eventCategory', '')) in ('heartbeat', 'health', 'availability', 'collector', 'system')
  );

create index if not exists ecosystem_flow_event_business_from_idx
  on public.ecosystem_flow_event (from_node, occurred_at desc, id desc)
  where not (
    lower(coalesce(event_type, '')) like '%heartbeat%' or
    lower(coalesce(event_type, '')) like '%health%' or
    lower(coalesce(event_type, '')) like '%availability%' or
    lower(coalesce(event_type, '')) like '%collector%' or
    lower(coalesce(event_type, '')) in ('service_unavailable', 'service_degraded') or
    lower(coalesce(event_type, '')) like '%system%' or
    lower(coalesce(metadata->>'eventCategory', '')) in ('heartbeat', 'health', 'availability', 'collector', 'system')
  );

create index if not exists ecosystem_flow_event_business_to_idx
  on public.ecosystem_flow_event (to_node, occurred_at desc, id desc)
  where not (
    lower(coalesce(event_type, '')) like '%heartbeat%' or
    lower(coalesce(event_type, '')) like '%health%' or
    lower(coalesce(event_type, '')) like '%availability%' or
    lower(coalesce(event_type, '')) like '%collector%' or
    lower(coalesce(event_type, '')) in ('service_unavailable', 'service_degraded') or
    lower(coalesce(event_type, '')) like '%system%' or
    lower(coalesce(metadata->>'eventCategory', '')) in ('heartbeat', 'health', 'availability', 'collector', 'system')
  );

create index if not exists ecosystem_flow_event_source_latest_idx
  on public.ecosystem_flow_event (lower(source_system_id), occurred_at desc, id desc)
  include (status)
  where source_system_id is not null;

create index if not exists ecosystem_flow_event_status_lower_occurred_idx
  on public.ecosystem_flow_event (lower(status), occurred_at desc);

create index if not exists ecosystem_flow_event_type_occurred_idx
  on public.ecosystem_flow_event (event_type, occurred_at desc);

analyze public.ecosystem_flow_event;
