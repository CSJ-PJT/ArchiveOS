package com.archiveos.ai.operations;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class KoreanBusinessDayServiceTest {
    private final KoreanBusinessDayService service = new KoreanBusinessDayService();

    @Test void excludesWeekendHolidayAndSubstituteHoliday() {
        assertThat(service.check(LocalDate.of(2026, 6, 27)).businessDay()).isFalse();
        assertThat(service.check(LocalDate.of(2026, 5, 5)).reason()).contains("Korean holiday");
        assertThat(service.check(LocalDate.of(2026, 5, 25)).reason()).contains("substitute holiday");
    }

    @Test void failsSafeWhenHolidayYearIsUnavailable() {
        var result = service.check(LocalDate.of(2027, 6, 28));
        assertThat(result.businessDay()).isFalse();
        assertThat(result.reason()).contains("holiday data unavailable");
    }
}
