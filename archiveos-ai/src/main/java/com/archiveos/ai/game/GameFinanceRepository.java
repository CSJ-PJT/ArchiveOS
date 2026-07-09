package com.archiveos.ai.game;

import com.archiveos.ai.obsidian.Json;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class GameFinanceRepository {
    private final JdbcTemplate jdbc;

    public GameFinanceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void upsertSnapshot(String run, String cycle, String tick, int day, String correlationId,
                               String systemId, Map<String, Object> service) {
        jdbc.update("""
                insert into public.game_service_finance_snapshot(
                  simulation_run_id, settlement_cycle_id, tick_id, day, correlation_id,
                  system_id, service_name, cash_balance, revenue_amount, cost_amount,
                  profit_amount, burn_rate, bankruptcy_risk
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(simulation_run_id, tick_id, system_id) do update set
                  settlement_cycle_id = excluded.settlement_cycle_id,
                  day = excluded.day,
                  correlation_id = excluded.correlation_id,
                  service_name = excluded.service_name,
                  cash_balance = excluded.cash_balance,
                  revenue_amount = excluded.revenue_amount,
                  cost_amount = excluded.cost_amount,
                  profit_amount = excluded.profit_amount,
                  burn_rate = excluded.burn_rate,
                  bankruptcy_risk = excluded.bankruptcy_risk
                """,
                run, cycle, tick, day, correlationId, systemId, String.valueOf(service.get("service")),
                decimal(service.get("cashAfter")), decimal(service.get("revenue")), decimal(service.get("cost")),
                decimal(service.get("profit")), decimal(service.get("burnRate")), String.valueOf(service.get("bankruptcyRisk")));
    }

    public void insertTrade(String tradeId, String run, String cycle, String tick, int day, String correlationId,
                            String sourceSystemId, String targetSystemId, String tradeType, BigDecimal amount,
                            String description, Map<String, Object> metadata) {
        jdbc.update("""
                insert into public.game_service_trade_ledger(
                  trade_id, simulation_run_id, settlement_cycle_id, tick_id, day, correlation_id,
                  source_system_id, target_system_id, trade_type, amount, description, metadata
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                on conflict(trade_id) do nothing
                """, tradeId, run, cycle, tick, day, correlationId, sourceSystemId, targetSystemId,
                tradeType, amount, description, Json.write(metadata == null ? Map.of() : metadata));
    }

    public Map<String, Object> financeSummary() {
        try {
            List<Map<String, Object>> systems = jdbc.query("""
                    select distinct on (system_id) *
                      from public.game_service_finance_snapshot
                     order by system_id, created_at desc
                    """, this::snapshotRow);
            List<Map<String, Object>> trades = recentTrades(80);
            Map<String, Object> bySystem = new LinkedHashMap<>();
            for (Map<String, Object> system : systems) {
                String systemId = String.valueOf(system.get("system_id"));
                Map<String, Object> detail = new LinkedHashMap<>(system);
                detail.put("exports", trades.stream().filter(row -> systemId.equals(row.get("source_system_id"))).limit(12).toList());
                detail.put("imports", trades.stream().filter(row -> systemId.equals(row.get("target_system_id"))).limit(12).toList());
                bySystem.put(systemId, detail);
            }
            return Map.of("systems", bySystem, "recentTrades", trades);
        } catch (DataAccessException error) {
            return Map.of("systems", Map.of(), "recentTrades", List.of(), "error", error.getMessage());
        }
    }

    public Map<String, Object> systemFinance(String systemId) {
        try {
            List<Map<String, Object>> snapshots = jdbc.query("""
                    select * from public.game_service_finance_snapshot
                     where system_id = ?
                     order by created_at desc
                     limit 30
                    """, this::snapshotRow, systemId);
            List<Map<String, Object>> exports = jdbc.query("""
                    select * from public.game_service_trade_ledger
                     where source_system_id = ?
                     order by created_at desc
                     limit 30
                    """, this::tradeRow, systemId);
            List<Map<String, Object>> imports = jdbc.query("""
                    select * from public.game_service_trade_ledger
                     where target_system_id = ?
                     order by created_at desc
                     limit 30
                    """, this::tradeRow, systemId);
            return Map.of(
                    "systemId", systemId,
                    "latest", snapshots.isEmpty() ? null : snapshots.get(0),
                    "snapshots", snapshots,
                    "exports", exports,
                    "imports", imports);
        } catch (DataAccessException error) {
            return Map.of("systemId", systemId, "latest", null, "snapshots", List.of(), "exports", List.of(), "imports", List.of(), "error", error.getMessage());
        }
    }

    private List<Map<String, Object>> recentTrades(int limit) {
        return jdbc.query("select * from public.game_service_trade_ledger order by created_at desc limit ?", this::tradeRow, Math.max(1, Math.min(limit, 200)));
    }

    private Map<String, Object> snapshotRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getLong("id"));
        value.put("simulation_run_id", rs.getString("simulation_run_id"));
        value.put("settlement_cycle_id", rs.getString("settlement_cycle_id"));
        value.put("tick_id", rs.getString("tick_id"));
        value.put("day", rs.getInt("day"));
        value.put("correlation_id", rs.getString("correlation_id"));
        value.put("system_id", rs.getString("system_id"));
        value.put("service_name", rs.getString("service_name"));
        value.put("cash_balance", rs.getBigDecimal("cash_balance"));
        value.put("revenue_amount", rs.getBigDecimal("revenue_amount"));
        value.put("cost_amount", rs.getBigDecimal("cost_amount"));
        value.put("profit_amount", rs.getBigDecimal("profit_amount"));
        value.put("burn_rate", rs.getBigDecimal("burn_rate"));
        value.put("bankruptcy_risk", rs.getString("bankruptcy_risk"));
        value.put("created_at", instant(rs, "created_at"));
        return value;
    }

    private Map<String, Object> tradeRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getLong("id"));
        value.put("trade_id", rs.getString("trade_id"));
        value.put("simulation_run_id", rs.getString("simulation_run_id"));
        value.put("settlement_cycle_id", rs.getString("settlement_cycle_id"));
        value.put("tick_id", rs.getString("tick_id"));
        value.put("day", rs.getInt("day"));
        value.put("correlation_id", rs.getString("correlation_id"));
        value.put("source_system_id", rs.getString("source_system_id"));
        value.put("target_system_id", rs.getString("target_system_id"));
        value.put("trade_type", rs.getString("trade_type"));
        value.put("amount", rs.getBigDecimal("amount"));
        value.put("currency", rs.getString("currency"));
        value.put("description", rs.getString("description"));
        value.put("metadata", Json.readObject(rs.getString("metadata")));
        value.put("created_at", instant(rs, "created_at"));
        return value;
    }

    private BigDecimal decimal(Object value) {
        if (value instanceof BigDecimal decimal) return decimal;
        if (value instanceof Number number) return BigDecimal.valueOf(number.doubleValue());
        if (value == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException error) {
            return BigDecimal.ZERO;
        }
    }

    private String instant(ResultSet rs, String name) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(name);
        return timestamp == null ? null : timestamp.toInstant().toString();
    }
}
