package com.archiveos.ai.knowledge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.archiveos.ai.obsidian.ObsidianJdbcRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class KnowledgeReadServiceTest {
    @Test void unavailableRepositoryReturnsStableEmptyReadContract() {
        KnowledgeJdbcRepository repository = org.mockito.Mockito.mock(KnowledgeJdbcRepository.class);
        ObsidianJdbcRepository obsidian = org.mockito.Mockito.mock(ObsidianJdbcRepository.class);
        when(repository.available()).thenReturn(false);
        when(obsidian.safeKnowledgeStatistics()).thenReturn(new ObsidianJdbcRepository.KnowledgeStatistics(0, 0, 0, 0, 0, 0, null, null));
        when(obsidian.safeVectorDiagnostics()).thenReturn(new ObsidianJdbcRepository.VectorStoreDiagnostics(false, false, false, "unknown", "offline"));
        KnowledgeReadService service = new KnowledgeReadService(repository, obsidian);

        assertThat(service.overview()).containsEntry("totalNodes", 0L).containsEntry("latestNodes", java.util.List.of());
        assertThat(service.health()).containsEntry("status", "degraded").containsEntry("available", false);
        assertThat(service.search("anything", 20)).isEmpty();
    }

    @Test void healthIncludesKnowledgeAndObsidianRepositoryStateWithoutOpenAi() {
        KnowledgeJdbcRepository repository = org.mockito.Mockito.mock(KnowledgeJdbcRepository.class);
        ObsidianJdbcRepository obsidian = org.mockito.Mockito.mock(ObsidianJdbcRepository.class);
        when(repository.available()).thenReturn(true); when(repository.nodeCount()).thenReturn(3L); when(repository.edgeCount()).thenReturn(2L);
        when(obsidian.safeKnowledgeStatistics()).thenReturn(new ObsidianJdbcRepository.KnowledgeStatistics(4, 8, 0, 8, 0, 0, null, null));
        when(obsidian.safeVectorDiagnostics()).thenReturn(new ObsidianJdbcRepository.VectorStoreDiagnostics(true, true, true, "hnsw", null));
        Map<String, Object> health = new KnowledgeReadService(repository, obsidian).health();
        assertThat(health).containsEntry("status", "healthy").containsEntry("nodeCount", 3L).containsEntry("documents", 4).containsEntry("embeddedChunks", 0);
    }

    @Test void projectsIndexedObsidianDocumentsWhenCanonicalKnowledgeGraphIsEmpty() {
        KnowledgeJdbcRepository repository = org.mockito.Mockito.mock(KnowledgeJdbcRepository.class);
        ObsidianJdbcRepository obsidian = org.mockito.Mockito.mock(ObsidianJdbcRepository.class);
        when(repository.available()).thenReturn(true);
        when(repository.nodeCount()).thenReturn(0L);
        when(obsidian.safeKnowledgeStatistics()).thenReturn(new ObsidianJdbcRepository.KnowledgeStatistics(1, 1, 1, 0, 0, 1536, null, null));
        when(obsidian.projectionDocuments(org.mockito.ArgumentMatchers.anyInt())).thenReturn(List.of(
                new ObsidianJdbcRepository.ProjectionDocument(7L, "operations/runbook.md", "운영 런북", "2026-08-20T00:00:00Z")));
        when(obsidian.projectionChunks(org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt())).thenReturn(List.of(
                new ObsidianJdbcRepository.ProjectionChunk(11L, 7L, 0, "복구 절차", "2026-08-20T00:00:00Z", "2026-08-21T00:00:00Z")));

        KnowledgeReadService service = new KnowledgeReadService(repository, obsidian);
        Map<String, Object> overview = service.overview();
        Map<String, Object> graph = service.graph(20);

        assertThat(overview).containsEntry("totalNodes", 2L).containsEntry("totalEdges", 1L);
        assertThat((List<?>) graph.get("nodes")).hasSize(2);
        assertThat((List<?>) graph.get("edges")).hasSize(1);
    }
}
