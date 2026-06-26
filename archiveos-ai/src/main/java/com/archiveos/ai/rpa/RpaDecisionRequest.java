package com.archiveos.ai.rpa;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RpaDecisionRequest(
        @NotBlank
        @Pattern(regexp = "approve|reject|hold|request_retry")
        String action,
        @Size(max = 4000) String reason,
        @Size(max = 120) String decidedBy) {}
