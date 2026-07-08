package com.archiveos.ai.atlas;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AtlasControllerTest {
    @Test void overviewUsesArchiveOsEnvelope() throws Exception {
        AtlasService service = org.mockito.Mockito.mock(AtlasService.class);
        when(service.overview()).thenReturn(Map.of(
                "system", Map.of("system_id", "atlas-platform", "current_status", "degraded"),
                "services", List.of(Map.of("service_id", "travel-atlas"))));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AtlasController(service)).build();
        mvc.perform(get("/api/atlas/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.system.system_id").value("atlas-platform"))
                .andExpect(jsonPath("$.data.services[0].service_id").value("travel-atlas"));
    }
}
