package com.archiveos.ai.rpa;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;

public record RpaTaskRequest(
        @NotBlank @Size(max = 160) String title,
        @NotBlank @Size(max = 8000) String description,
        @Size(max = 120) String targetProject,
        @Size(max = 120) String requestedBy,
        Map<String, Object> metadata) {}
