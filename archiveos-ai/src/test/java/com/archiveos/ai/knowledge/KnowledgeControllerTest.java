package com.archiveos.ai.knowledge;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class KnowledgeControllerTest {
    @Test void preservesOverviewEnvelope() throws Exception {
        KnowledgeReadService service = org.mockito.Mockito.mock(KnowledgeReadService.class);
        when(service.overview()).thenReturn(Map.of("totalNodes", 2, "totalEdges", 1));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new KnowledgeController(service)).build();
        mvc.perform(get("/api/knowledge/overview")).andExpect(status().isOk()).andExpect(jsonPath("$.data.totalNodes").value(2));
    }

    @Test void missingNodePreservesNotFoundContract() throws Exception {
        KnowledgeReadService service = org.mockito.Mockito.mock(KnowledgeReadService.class);
        when(service.detail("missing")).thenReturn(null);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new KnowledgeController(service)).build();
        mvc.perform(get("/api/knowledge/node/missing")).andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("Knowledge node not found."));
    }
}
