package com.archiveos.ai.audit;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class UsageAuditControllerTest {
    @Test
    void readsOneKoreanCalendarDay() throws Exception {
        UsageAuditService service = mock(UsageAuditService.class);
        when(service.recent(0, 25, "2026-08-28")).thenReturn(java.util.Map.of(
                "selected_date", "2026-08-28", "items", java.util.List.of(), "total", 0));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new UsageAuditController(service)).build();

        mvc.perform(get("/api/audit/usage").param("date", "2026-08-28"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.selected_date").value("2026-08-28"));
    }

    @Test
    void acceptsValidPageViewWithoutEchoingRequestDetails() throws Exception {
        UsageAuditService service = mock(UsageAuditService.class);
        when(service.recordPageView(eq("dashboard"), any())).thenReturn(new UsageAuditService.RecordResult(true, false, "recorded"));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new UsageAuditController(service)).build();

        mvc.perform(post("/api/audit/usage").contentType(MediaType.APPLICATION_JSON).content("{\"route\":\"dashboard\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.recorded").value(true))
                .andExpect(jsonPath("$.data.reason").value("recorded"));
    }

    @Test
    void rejectsUnknownPageView() throws Exception {
        UsageAuditService service = mock(UsageAuditService.class);
        when(service.recordPageView(eq("private"), any())).thenThrow(new IllegalArgumentException("지원하지 않는 ArchiveOS 화면입니다."));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new UsageAuditController(service)).build();

        mvc.perform(post("/api/audit/usage").contentType(MediaType.APPLICATION_JSON).content("{\"route\":\"private\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("지원하지 않는 ArchiveOS 화면입니다."));
    }

    @Test
    void acceptsAggregateAtlasReport() throws Exception {
        UsageAuditService service = mock(UsageAuditService.class);
        when(service.importAtlasReport(any())).thenReturn(java.util.Map.of(
                "imported", true, "targetDate", "2026-08-27", "projectCount", 13));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new UsageAuditController(service)).build();

        mvc.perform(post("/api/audit/usage/atlas-report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"schemaVersion\":1}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.imported").value(true))
                .andExpect(jsonPath("$.data.projectCount").value(13));
    }

    @Test
    void acceptsAtlasPageEventBatch() throws Exception {
        UsageAuditService service = mock(UsageAuditService.class);
        when(service.importAtlasEvents(any())).thenReturn(java.util.Map.of("accepted", 1, "imported", 1, "duplicates", 0));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new UsageAuditController(service)).build();

        mvc.perform(post("/api/audit/usage/atlas-events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"schemaVersion\":1}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.imported").value(1));
    }
}
