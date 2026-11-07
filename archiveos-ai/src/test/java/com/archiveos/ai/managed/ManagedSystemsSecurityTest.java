package com.archiveos.ai.managed;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.security.SecurityConfiguration;
import com.archiveos.ai.security.SessionAuthenticationFilter;
import com.archiveos.ai.security.SessionService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ManagedSystemsController.class)
@Import({SecurityConfiguration.class, SessionAuthenticationFilter.class})
class ManagedSystemsSecurityTest {
    @Autowired
    private MockMvc mvc;
    @MockBean
    private ManagedSystemsService service;
    @MockBean
    private SessionService sessions;
    @MockBean
    private AuditLogService audit;

    @Test
    void publicCanReadManagedSystemsAndPmInboxWithoutMutation() throws Exception {
        when(service.systems()).thenReturn(List.of(Map.of("systemId", "archive-os")));
        when(service.pmInbox()).thenReturn(List.of());

        mvc.perform(get("/api/managed-systems"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].systemId").value("archive-os"));
        mvc.perform(get("/api/pm-inbox"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        verify(service, never()).acknowledge(org.mockito.ArgumentMatchers.any());
        verify(service, never()).resolve(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void publicCannotAcknowledgeOrResolveEvenWithoutCsrfToken() throws Exception {
        mvc.perform(post("/api/pm-inbox/item-1/acknowledge"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/pm-inbox/item-1/resolve"))
                .andExpect(status().isUnauthorized());

        verify(service, never()).acknowledge(org.mockito.ArgumentMatchers.any());
        verify(service, never()).resolve(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void nonAdminCannotMutatePmInbox() throws Exception {
        mvc.perform(post("/api/pm-inbox/item-1/resolve").with(user("pm").roles("PM")))
                .andExpect(status().isForbidden());
        verify(service, never()).resolve(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void adminCanAcknowledgeAndResolve() throws Exception {
        when(service.acknowledge("item-1")).thenReturn(Map.of("id", "item-1", "status", "acknowledged"));
        when(service.resolve("item-1")).thenReturn(Map.of("id", "item-1", "status", "resolved"));

        mvc.perform(post("/api/pm-inbox/item-1/acknowledge").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("acknowledged"));
        mvc.perform(post("/api/pm-inbox/item-1/resolve").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("resolved"));
    }

    @Test
    void missingItemUsesExistingValidationErrorContract() throws Exception {
        when(service.acknowledge("missing")).thenThrow(new ManagedSystemsValidationException("PM inbox item not found."));

        mvc.perform(post("/api/pm-inbox/missing/acknowledge").with(user("admin").roles("ADMIN")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("PM inbox item not found."));
    }
}
