package com.archiveos.ai.operations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.notification.NotificationService;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DailyReportServiceTest {
    @Test void weekendReportIsPersistedAsSkippedWithoutNotification() {
        OperationsRepository repository = org.mockito.Mockito.mock(OperationsRepository.class);
        NightlyReviewService nightly = org.mockito.Mockito.mock(NightlyReviewService.class);
        NotificationService notifications = org.mockito.Mockito.mock(NotificationService.class);
        LocalDate saturday = LocalDate.of(2026, 6, 27);
        Map<String, Object> nightlySummary = summary(saturday.minusDays(1));
        when(repository.latestBatch("nightly_review", saturday.minusDays(1))).thenReturn(Map.of("metadata", nightlySummary));
        when(repository.saveDailyReport(any())).thenReturn(Map.of("id", "report-1"));
        when(repository.saveBatch(eq("daily_report"), eq("skipped"), eq(saturday.minusDays(1)), any(), any())).thenAnswer(invocation -> Map.of("status", "skipped", "summary", invocation.getArgument(3)));
        DailyReportService service = new DailyReportService(repository, nightly, new KoreanBusinessDayService(), notifications, "");

        Map<String, Object> result = service.run(saturday);

        assertThat(result).containsEntry("status", "skipped");
        verify(notifications, never()).send(any());
        verify(repository).saveDailyReport(any());
    }

    private Map<String, Object> summary(LocalDate date) {
        Map<String, Object> value = new HashMap<>();
        value.put("date", date.toString()); value.put("operationStatus", "normal"); value.put("statusReason", "정상");
        value.put("queue", Map.of("inbox", 0, "processing", 0, "outbox", 1, "reviews", 1));
        value.put("operators", Map.of("implementer", "미감지", "reviewer", "미감지", "loop", "미감지", "reviewerBridge", "미감지"));
        value.put("warnings", List.of()); value.put("decisions", Map.of("count", 0)); value.put("commands", Map.of("count", 0));
        value.put("latestBuilder", null); value.put("latestReviewer", null); return value;
    }
}
