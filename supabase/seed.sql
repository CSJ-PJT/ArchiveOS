insert into public.agents (id, name, role, status, current_task)
values
  ('11111111-1111-4111-8111-111111111111', 'Atlas', 'Planner', 'working', 'Breaking down onboarding tasks'),
  ('22222222-2222-4222-8222-222222222222', 'Nova', 'Builder', 'reviewing', 'Checking dashboard data flow'),
  ('33333333-3333-4333-8333-333333333333', 'Cipher', 'Reviewer', 'waiting', 'Waiting for schema approval'),
  ('44444444-4444-4444-8444-444444444444', 'Echo', 'Logger', 'idle', null)
on conflict (id) do update
set
  name = excluded.name,
  role = excluded.role,
  status = excluded.status,
  current_task = excluded.current_task;

insert into public.tasks (id, title, description, assigned_agent_id, priority, status)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Design agent status model',
    'Define the smallest useful status set for dashboard visibility.',
    '11111111-1111-4111-8111-111111111111',
    'high',
    'in_progress'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Wire Supabase reads',
    'Connect the frontend dashboard to agents, tasks, and work logs.',
    '22222222-2222-4222-8222-222222222222',
    'high',
    'review'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Document local setup',
    'Keep setup instructions lightweight for the MVP.',
    '44444444-4444-4444-8444-444444444444',
    'medium',
    'todo'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'Confirm auth scope',
    'Explicitly defer authentication until the operations flow is proven.',
    '33333333-3333-4333-8333-333333333333',
    'low',
    'done'
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  assigned_agent_id = excluded.assigned_agent_id,
  priority = excluded.priority,
  status = excluded.status;

insert into public.work_logs (id, task_id, agent_id, log_type, content, created_at)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'summary',
    'Agent status values were reduced to the five states needed for operational triage.',
    now() - interval '5 hours'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'decision',
    'Use direct Supabase reads from the Vite frontend for the MVP and defer a backend server.',
    now() - interval '4 hours'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '33333333-3333-4333-8333-333333333333',
    'decision',
    'Authentication remains out of scope until the first dashboard workflow is validated.',
    now() - interval '2 hours'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'review',
    'Dashboard queries should order by updated_at and created_at so live operations stay visible.',
    now() - interval '1 hour'
  )
on conflict (id) do update
set
  task_id = excluded.task_id,
  agent_id = excluded.agent_id,
  log_type = excluded.log_type,
  content = excluded.content,
  created_at = excluded.created_at;
