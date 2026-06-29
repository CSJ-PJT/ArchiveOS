package com.archiveos.ai.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PlatformRuntimeService {
    private final Instant startedAt = Instant.now();
    private final String publicUrl;
    private final String backendPublicUrl;
    private final String gitCommit;
    private final String gitBranch;
    private final String applicationVersion;

    public PlatformRuntimeService(
            @Value("${archiveos.public-url:}") String publicUrl,
            @Value("${archiveos.backend-public-url:}") String backendPublicUrl,
            @Value("${archiveos.git-commit:}") String gitCommit,
            @Value("${archiveos.git-branch:}") String gitBranch,
            @Value("${spring.application.version:0.1.0}") String applicationVersion) {
        this.publicUrl = normalize(publicUrl);
        this.backendPublicUrl = normalize(backendPublicUrl);
        this.gitCommit = normalize(gitCommit);
        this.gitBranch = normalize(gitBranch);
        this.applicationVersion = normalize(applicationVersion);
    }

    public Map<String, Object> version() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("commitSha", gitCommit);
        data.put("branch", gitBranch);
        data.put("startedAt", startedAt.toString());
        data.put("backendVersion", applicationVersion);
        data.put("checkedAt", Instant.now().toString());
        return data;
    }

    public Map<String, Object> publicAccess(HttpServletRequest request) {
        String requestOrigin = requestOrigin(request);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("backendBaseUrlConfigured", backendPublicUrl != null);
        data.put("frontendPublicUrlConfigured", publicUrl != null);
        data.put("backendUrlSource", backendPublicUrl != null ? "env" : requestOrigin != null ? "request" : "unknown");
        data.put("frontendPublicUrl", publicUrl);
        data.put("backendPublicUrl", backendPublicUrl != null ? backendPublicUrl : requestOrigin);
        data.put("checkedAt", Instant.now().toString());
        return data;
    }

    private String requestOrigin(HttpServletRequest request) {
        String forwardedProto = normalize(request.getHeader("x-forwarded-proto"));
        String forwardedHost = normalize(request.getHeader("x-forwarded-host"));
        if (forwardedProto != null && forwardedHost != null) return forwardedProto + "://" + forwardedHost;
        String host = normalize(request.getHeader("host"));
        return host == null ? null : request.getScheme() + "://" + host;
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
