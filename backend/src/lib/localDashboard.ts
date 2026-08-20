import { Pool } from "pg";

type DashboardData = {
  agents: unknown[];
  tasks: unknown[];
  logs: unknown[];
  decisions: unknown[];
};

const connectionString = process.env.ARCHIVEOS_DASHBOARD_DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString, max: 4 }) : null;

export const isLocalDashboardConfigured = Boolean(pool);

export async function queryLocalDashboard<T extends object>(text: string, values: unknown[] = []): Promise<T[]> {
  if (!pool) throw new Error("Local ArchiveOS dashboard database is not configured.");
  const result = await pool.query(text, values);
  return result.rows as T[];
}

export async function getLocalDashboardData(): Promise<DashboardData> {
  if (!pool) {
    throw new Error("Local ArchiveOS dashboard database is not configured.");
  }

  const [agents, tasks, logs, decisions] = await Promise.all([
    pool.query("select * from public.agents order by name asc"),
    pool.query(`
      select t.*, jsonb_build_object('name', a.name, 'status', a.status) as agent
      from public.tasks t
      left join public.agents a on a.id = t.assigned_agent_id
      order by t.updated_at desc
    `),
    pool.query(`
      select w.*, jsonb_build_object('title', t.title, 'status', t.status) as task,
             jsonb_build_object('name', a.name, 'role', a.role) as agent
      from public.work_logs w
      left join public.tasks t on t.id::text = w.task_id
      left join public.agents a on a.id::text = w.agent_id
      order by w.created_at desc
      limit 8
    `),
    pool.query(`
      select w.*, jsonb_build_object('title', t.title, 'status', t.status) as task,
             jsonb_build_object('name', a.name, 'role', a.role) as agent
      from public.work_logs w
      left join public.tasks t on t.id::text = w.task_id
      left join public.agents a on a.id::text = w.agent_id
      where w.log_type = 'decision'
      order by w.created_at desc
      limit 20
    `),
  ]);

  return {
    agents: agents.rows,
    tasks: tasks.rows,
    logs: logs.rows,
    decisions: decisions.rows,
  };
}
