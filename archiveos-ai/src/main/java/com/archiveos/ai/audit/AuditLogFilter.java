package com.archiveos.ai.audit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

public class AuditLogFilter extends OncePerRequestFilter {
    private static final Set<String> MUTATIONS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private final AuditLogService audit;
    private final ObjectMapper mapper;

    public AuditLogFilter(AuditLogService audit, ObjectMapper mapper) {
        this.audit = audit;
        this.mapper = mapper;
    }

    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return "/api/audit/compatibility".equals(request.getRequestURI())
                || !request.getRequestURI().startsWith("/api/") || !MUTATIONS.contains(request.getMethod());
    }

    @Override protected void doFilterInternal(HttpServletRequest rawRequest, HttpServletResponse rawResponse, FilterChain chain)
            throws ServletException, IOException {
        ContentCachingRequestWrapper request = new ContentCachingRequestWrapper(rawRequest);
        ContentCachingResponseWrapper response = new ContentCachingResponseWrapper(rawResponse);
        String path = request.getRequestURI();
        JsonNode before = audit.snapshot(path);
        String correlationId = request.getHeader("X-Correlation-Id");
        if (correlationId == null || correlationId.isBlank()) correlationId = UUID.randomUUID().toString();
        response.setHeader("X-Correlation-Id", correlationId);
        try {
            chain.doFilter(request, response);
        } finally {
            JsonNode after = audit.snapshot(path);
            if (after == null) after = readJson(response.getContentAsByteArray());
            if (after == null) after = readJson(request.getContentAsByteArray());
            try { audit.record(request.getMethod(), path, response.getStatus(), correlationId, before, after); }
            catch (RuntimeException ignored) { }
            response.copyBodyToResponse();
        }
    }

    private JsonNode readJson(byte[] value) {
        if (value == null || value.length == 0) return null;
        try { return mapper.readTree(new String(value, StandardCharsets.UTF_8)); }
        catch (Exception ignored) { return null; }
    }
}
