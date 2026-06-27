package com.archiveos.ai.operations;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class KoreanBusinessDayService {
    private static final Map<LocalDate, String> HOLIDAYS_2026 = Map.ofEntries(
            Map.entry(LocalDate.of(2026, 1, 1), "New Year's Day"),
            Map.entry(LocalDate.of(2026, 2, 16), "Seollal holiday"),
            Map.entry(LocalDate.of(2026, 2, 17), "Seollal"),
            Map.entry(LocalDate.of(2026, 2, 18), "Seollal holiday"),
            Map.entry(LocalDate.of(2026, 3, 1), "Independence Movement Day"),
            Map.entry(LocalDate.of(2026, 3, 2), "Substitute holiday for Independence Movement Day"),
            Map.entry(LocalDate.of(2026, 5, 1), "Labor Day"),
            Map.entry(LocalDate.of(2026, 5, 5), "Children's Day"),
            Map.entry(LocalDate.of(2026, 5, 24), "Buddha's Birthday"),
            Map.entry(LocalDate.of(2026, 5, 25), "Substitute holiday for Buddha's Birthday"),
            Map.entry(LocalDate.of(2026, 6, 3), "Local election day"),
            Map.entry(LocalDate.of(2026, 6, 6), "Memorial Day"),
            Map.entry(LocalDate.of(2026, 8, 15), "Liberation Day"),
            Map.entry(LocalDate.of(2026, 8, 17), "Substitute holiday for Liberation Day"),
            Map.entry(LocalDate.of(2026, 9, 24), "Chuseok holiday"),
            Map.entry(LocalDate.of(2026, 9, 25), "Chuseok"),
            Map.entry(LocalDate.of(2026, 9, 26), "Chuseok holiday"),
            Map.entry(LocalDate.of(2026, 9, 27), "Chuseok holiday"),
            Map.entry(LocalDate.of(2026, 9, 28), "Substitute holiday for Chuseok"),
            Map.entry(LocalDate.of(2026, 10, 3), "National Foundation Day"),
            Map.entry(LocalDate.of(2026, 10, 5), "Substitute holiday for National Foundation Day"),
            Map.entry(LocalDate.of(2026, 10, 9), "Hangeul Day"),
            Map.entry(LocalDate.of(2026, 12, 25), "Christmas Day"));

    public BusinessDayResult check(LocalDate date) {
        if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return new BusinessDayResult(false, "weekend");
        }
        if (date.getYear() != 2026) {
            return new BusinessDayResult(false, "holiday data unavailable for " + date.getYear());
        }
        String holiday = HOLIDAYS_2026.get(date);
        if (holiday != null) {
            String prefix = holiday.toLowerCase().contains("substitute") ? "substitute holiday: " : "Korean holiday: ";
            return new BusinessDayResult(false, prefix + holiday);
        }
        return new BusinessDayResult(true, "business day");
    }

    public record BusinessDayResult(boolean businessDay, String reason) {}
}
