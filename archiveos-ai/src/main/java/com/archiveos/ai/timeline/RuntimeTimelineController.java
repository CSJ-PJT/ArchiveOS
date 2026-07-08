package com.archiveos.ai.timeline;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/runtime/timeline")
public class RuntimeTimelineController {
    private final JdbcTemplate jdbc;
    public RuntimeTimelineController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping
    public Map<String, Object> timeline(@RequestParam(defaultValue = "100") int limit,
                                        @RequestParam(required = false) String correlationId) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        Object data = correlationId == null || correlationId.isBlank()
                ? jdbc.queryForList("select * from public.runtime_timeline order by occurred_at desc limit ?", safeLimit)
                : jdbc.queryForList("select * from public.runtime_timeline where correlation_id = ? order by occurred_at desc limit ?", correlationId, safeLimit);
        return Map.of("data", data);
    }
}
