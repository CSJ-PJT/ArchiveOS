package com.archiveos.ai.rpa;

import java.util.Locale;
import java.util.Map;

final class RpaRuleClassifier {
    private RpaRuleClassifier() {}

    static RpaClassification classify(RpaTaskRecord task, String source, String error) {
        String text = (task.title() + "\n" + task.description()).toLowerCase(Locale.ROOT);
        boolean executionRisk = containsAny(text, "shell", "mcp execution", "codex control", "deploy", "push", "delete", "drop", "truncate", "secret", "token");
        boolean dataRisk = containsAny(text, "database", "postgres", "supabase", "migration", "schema", "payment", "settlement", "batch");
        boolean architecture = containsAny(text, "architecture", "design", "refactor", "workflow", "agent", "rpa");

        String risk = executionRisk ? "high" : dataRisk ? "medium" : "low";
        String category = executionRisk
                ? "execution_control"
                : dataRisk
                    ? "data_operation"
                    : architecture
                        ? "architecture_review"
                        : "general_operations";
        String recommendation = executionRisk
                ? "PM_APPROVAL_REQUIRED"
                : dataRisk
                    ? "REVIEW_BEFORE_EXECUTION"
                    : "PROCEED_WITH_LOGGING";
        boolean approvalRequired = executionRisk || dataRisk;
        String summary = switch (risk) {
            case "high" -> "위험 실행 또는 비밀/배포 관련 키워드가 감지되어 PM 승인 전 실행하면 안 됩니다.";
            case "medium" -> "데이터, 배치, 스키마 또는 운영 변경 가능성이 있어 검토 후 진행해야 합니다.";
            default -> "직접 실행 위험은 낮지만 ArchiveOS 실행 이력에 기록해야 합니다.";
        };

        return new RpaClassification(category, risk, recommendation, approvalRequired, summary, source, error, Map.of(
                "executionRisk", executionRisk,
                "dataRisk", dataRisk,
                "architectureRelated", architecture));
    }

    private static boolean containsAny(String value, String... patterns) {
        for (String pattern : patterns) {
            if (value.contains(pattern)) return true;
        }
        return false;
    }
}
