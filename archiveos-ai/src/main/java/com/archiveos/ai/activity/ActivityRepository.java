package com.archiveos.ai.activity;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ActivityRepository {
    private final JdbcTemplate jdbc;
    public ActivityRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Map<String, Object>> recentWorkLogs(int limit) {
        return jdbc.query("select * from public.work_logs order by created_at desc limit ?", this::workLog, limit);
    }

    public Map<String, Object> createWorkLog(String taskId, String agentId, String logType, String content) {
        return jdbc.queryForObject("""
                insert into public.work_logs(task_id, agent_id, log_type, content) values (?, ?, ?, ?) returning *
                """, this::workLog, taskId, agentId, logType, content);
    }

    public List<Map<String, Object>> recentCommands(int limit) {
        return jdbc.query("select * from public.command_runs order by created_at desc limit ?", this::command, limit);
    }

    public Map<String, Object> createCommand(String command, String commandType, String status, String result) {
        return jdbc.queryForObject("""
                insert into public.command_runs(command, command_type, status, result) values (?, ?, ?, ?) returning *
                """, this::command, command, commandType, status, result);
    }

    private Map<String, Object> workLog(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getObject("id").toString());
        value.put("task_id", rs.getString("task_id"));
        value.put("agent_id", rs.getString("agent_id"));
        value.put("log_type", rs.getString("log_type"));
        value.put("content", rs.getString("content"));
        value.put("created_at", rs.getTimestamp("created_at").toInstant());
        value.put("task", null);
        value.put("agent", null);
        return value;
    }

    private Map<String, Object> command(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getObject("id").toString());
        value.put("command", rs.getString("command"));
        value.put("command_type", rs.getString("command_type"));
        value.put("status", rs.getString("status"));
        value.put("result", rs.getString("result"));
        value.put("created_at", rs.getTimestamp("created_at").toInstant());
        value.put("updated_at", rs.getTimestamp("updated_at").toInstant());
        return value;
    }
}
