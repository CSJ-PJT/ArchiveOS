package com.archiveos.ai.audit;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class UsageAuditControllerTest {
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
}
