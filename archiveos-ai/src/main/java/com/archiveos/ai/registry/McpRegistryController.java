package com.archiveos.ai.registry;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mcp")
public class McpRegistryController {
    private final JdbcTemplate jdbc;
    public McpRegistryController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/registry")
    public Map<String, Object> registry() {
        return Map.of("data", jdbc.queryForList("""
                select id, tool, provider, capability, permission, approval_required, health, last_run, enabled, metadata
                from public.mcp_registry order by provider, tool
                """));
    }
}
