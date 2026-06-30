package com.archiveos.ai.knowledge;

import com.archiveos.ai.knowledge.KnowledgeJdbcRepository.KnowledgeEdge;
import com.archiveos.ai.knowledge.KnowledgeJdbcRepository.KnowledgeNode;
import com.archiveos.ai.obsidian.ObsidianJdbcRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class KnowledgeReadService {
    private final KnowledgeJdbcRepository repository;
    private final ObsidianJdbcRepository obsidian;

    public KnowledgeReadService(KnowledgeJdbcRepository repository, ObsidianJdbcRepository obsidian) {
        this.repository = repository; this.obsidian = obsidian;
    }

    public Map<String, Object> health() {
        try {
            boolean available = repository.available();
            var stats = obsidian.safeKnowledgeStatistics();
            var vector = obsidian.safeVectorDiagnostics();
            long nodes = available ? repository.nodeCount() : 0; long edges = available ? repository.edgeCount() : 0;
            String status = !available || !vector.databaseConnected() ? "degraded" : nodes == 0 && stats.documents() == 0 ? "empty" : "healthy";
            return map("status", status, "available", available, "nodeCount", nodes, "edgeCount", edges,
                    "documents", stats.documents(), "chunks", stats.chunks(), "embeddedChunks", stats.embeddedChunks(),
                    "databaseConnected", vector.databaseConnected(), "vectorExtensionInstalled", vector.extensionInstalled(),
                    "vectorIndexReady", vector.indexReady(), "lastError", stats.lastError() != null ? stats.lastError() : vector.lastError());
        } catch (Exception error) {
            return map("status", "degraded", "available", false, "nodeCount", 0, "edgeCount", 0, "documents", 0,
                    "chunks", 0, "embeddedChunks", 0, "databaseConnected", false, "vectorExtensionInstalled", false,
                    "vectorIndexReady", false, "lastError", "Knowledge repository check failed.");
        }
    }

    public Map<String, Object> overview() {
        if (!repository.available()) return map("totalNodes", 0, "totalEdges", 0, "countsByType", Map.of(), "latestNodes", List.of(), "latestEdges", List.of());
        List<KnowledgeNode> nodes = repository.recentNodes(8);
        List<Map<String, Object>> edges = enrich(repository.recentEdges(8));
        return map("totalNodes", repository.nodeCount(), "totalEdges", repository.edgeCount(), "countsByType", repository.countsByType(), "latestNodes", nodes, "latestEdges", edges);
    }

    public List<KnowledgeNode> recent(int limit) { return repository.available() ? repository.recentNodes(limit) : List.of(); }
    public List<KnowledgeNode> search(String query, int limit) { return !repository.available() || query == null || query.isBlank() ? List.of() : repository.search(query.trim(), limit); }

    public List<Map<String, Object>> related(String externalRef, String nodeType) {
        if (!repository.available()) return List.of();
        String ref = clean(externalRef); String type = clean(nodeType);
        if (ref == null && type == null) return List.of();
        return repository.matching(ref, type).stream().map(node -> detail(node.id())).toList();
    }

    public Map<String, Object> detail(String id) {
        if (!repository.available()) return null;
        KnowledgeNode node = repository.node(id); if (node == null) return null;
        List<Map<String, Object>> outgoing = enrich(repository.outgoing(id));
        List<Map<String, Object>> incoming = enrich(repository.incoming(id));
        List<Map<String, Object>> all = new ArrayList<>(outgoing); all.addAll(incoming);
        return map("node", node, "outgoing", outgoing, "incoming", incoming, "related", all);
    }

    public Map<String, Object> graph(int limit) {
        if (!repository.available()) return emptyGraph();
        int safe = Math.min(Math.max(limit, 1), 300);
        List<KnowledgeNode> rawNodes = repository.recentNodes(safe);
        Map<String, KnowledgeNode> byId = rawNodes.stream().collect(Collectors.toMap(KnowledgeNode::id, Function.identity()));
        List<KnowledgeEdge> rawEdges = repository.recentEdges(safe * 2).stream().filter(edge -> byId.containsKey(edge.from_node_id()) && byId.containsKey(edge.to_node_id())).limit(safe).toList();
        List<Map<String, Object>> nodes = rawNodes.stream().map(node -> graphNode(node, rawEdges, byId)).toList();
        List<Map<String, Object>> edges = rawEdges.stream().map(edge -> graphEdge(edge, byId)).toList();
        Map<String, Long> types = nodes.stream().collect(Collectors.groupingBy(item -> String.valueOf(item.get("type")), LinkedHashMap::new, Collectors.counting()));
        return map("nodes", nodes, "edges", edges, "stats", map("nodeCount", nodes.size(), "edgeCount", edges.size(), "types", types));
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> insights(int limit) {
        Map<String, Object> graph = graph(limit);
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) graph.get("nodes");
        List<Map<String, Object>> edges = (List<Map<String, Object>>) graph.get("edges");
        List<Map<String, Object>> topNodes = nodes.stream().sorted(Comparator.comparingInt(item -> -number(item, "importanceScore"))).limit(8)
                .map(item -> map("id", item.get("id"), "label", item.get("label"), "type", item.get("type"), "importanceScore", item.get("importanceScore"), "importanceLevel", item.get("importanceLevel"), "reason", nodeReason(item), "degree", item.get("degree"))).toList();
        List<Map<String, Object>> topEdges = edges.stream().sorted(Comparator.comparingInt(item -> -number(item, "importanceScore"))).limit(8)
                .map(item -> map("id", item.get("id"), "from", item.get("from"), "to", item.get("to"), "type", item.get("type"), "importanceScore", item.get("importanceScore"), "importanceLevel", item.get("importanceLevel"), "reason", edgeReason(item))).toList();
        List<Map<String, Object>> chains = decisionChains(nodes, edges);
        List<String> notes = new ArrayList<>();
        if (nodes.isEmpty()) notes.add("No knowledge nodes are available yet.");
        if (topNodes.stream().noneMatch(item -> List.of("high", "critical").contains(item.get("importanceLevel")))) notes.add("No high-importance nodes yet. Run Daily Report, Nightly Review, Architect Review, and Decision recording to create stronger relationships.");
        if (chains.isEmpty()) notes.add("No decision chains yet. Command, review, decision, and report nodes need linked edges before trace paths appear.");
        return map("topNodes", topNodes, "topEdges", topEdges, "decisionChains", chains, "graphHealth", map(
                "nodeCount", nodes.size(), "edgeCount", edges.size(), "hubCount", countTrue(nodes, "isHub"),
                "criticalCount", nodes.stream().filter(item -> "critical".equals(item.get("importanceLevel"))).count(),
                "recentCount", countTrue(nodes, "isRecent"), "isolatedNodeCount", nodes.stream().filter(item -> number(item, "degree") == 0).count()), "notes", notes);
    }

    private List<Map<String, Object>> enrich(List<KnowledgeEdge> edges) {
        return edges.stream().map(edge -> { Map<String, Object> value = new LinkedHashMap<>(edgeMap(edge)); value.put("from_node", repository.node(edge.from_node_id())); value.put("to_node", repository.node(edge.to_node_id())); return value; }).toList();
    }

    private Map<String, Object> graphNode(KnowledgeNode node, List<KnowledgeEdge> edges, Map<String, KnowledgeNode> byId) {
        List<KnowledgeEdge> related = edges.stream().filter(edge -> edge.from_node_id().equals(node.id()) || edge.to_node_id().equals(node.id())).toList();
        int in = (int) related.stream().filter(edge -> edge.to_node_id().equals(node.id())).count(); int out = related.size() - in;
        boolean recent = recent(node.created_at()) || related.stream().anyMatch(edge -> recent(edge.created_at()));
        boolean decision = "decision".equals(node.node_type()) || related.stream().map(edge -> byId.get(edge.from_node_id().equals(node.id()) ? edge.to_node_id() : edge.from_node_id())).anyMatch(item -> item != null && "decision".equals(item.node_type()));
        List<KnowledgeNode> relatedNodes = related.stream().map(edge -> byId.get(edge.from_node_id().equals(node.id()) ? edge.to_node_id() : edge.from_node_id())).filter(java.util.Objects::nonNull).toList();
        int score = related.size() + switch (node.node_type()) { case "decision", "architecture_review" -> 3; case "incident", "daily_report", "nightly_review" -> 2; default -> 0; } + (related.size() >= 2 ? 2 : 0) + (recent ? 2 : 0) + (decision ? 3 : 0)
                + (relatedNodes.stream().anyMatch(item -> "architecture_review".equals(item.node_type())) ? 3 : 0)
                + (relatedNodes.stream().anyMatch(item -> "incident".equals(item.node_type())) ? 3 : 0);
        return map("id", node.id(), "type", node.node_type(), "label", label(node), "title", node.title(), "summary", node.summary(), "source", node.source(), "externalRef", node.external_ref(), "createdAt", node.created_at(), "metadata", sanitize(node.metadata()), "importanceScore", score, "importanceLevel", level(score), "degree", related.size(), "inDegree", in, "outDegree", out, "lastReferencedAt", related.stream().map(KnowledgeEdge::created_at).max(String::compareTo).orElse(null), "isRecent", recent, "isHub", related.size() >= 3, "isDecisionRelevant", decision);
    }

    private Map<String, Object> graphEdge(KnowledgeEdge edge, Map<String, KnowledgeNode> byId) {
        var from = byId.get(edge.from_node_id()); var to = byId.get(edge.to_node_id());
        boolean decision = hasType(from, to, "decision"), architect = hasType(from, to, "architecture_review"), incident = hasType(from, to, "incident"), recent = recent(edge.created_at());
        int score = switch (edge.edge_type()) { case "reviewed_architecture_of", "references_memory" -> 3; case "reviewed_by", "mentioned_in" -> 2; default -> 0; } + (decision ? 2 : 0) + (architect ? 2 : 0) + (incident ? 2 : 0) + (recent ? 1 : 0);
        return map("id", edge.id(), "from", edge.from_node_id(), "to", edge.to_node_id(), "type", edge.edge_type(), "label", edge.edge_type(), "confidence", edge.confidence(), "createdAt", edge.created_at(), "metadata", sanitize(edge.metadata()), "importanceScore", score, "importanceLevel", level(score), "isRecent", recent, "isDecisionPath", decision, "isArchitectPath", architect, "isIncidentPath", incident);
    }

    private List<Map<String, Object>> decisionChains(List<Map<String, Object>> nodes, List<Map<String, Object>> edges) {
        Map<String, Map<String, Object>> byId = nodes.stream().collect(Collectors.toMap(item -> String.valueOf(item.get("id")), Function.identity()));
        return nodes.stream().filter(node -> "decision".equals(node.get("type"))).map(node -> {
            String id = String.valueOf(node.get("id")); List<Map<String, Object>> linked = edges.stream().filter(edge -> id.equals(edge.get("from")) || id.equals(edge.get("to"))).map(edge -> byId.get(id.equals(edge.get("from")) ? String.valueOf(edge.get("to")) : String.valueOf(edge.get("from")))).filter(java.util.Objects::nonNull).toList();
            return map("decisionNodeId", id, "decisionLabel", node.get("label"), "relatedReviews", chain(linked, "reviewer_result"), "relatedCommands", chain(linked, "command"), "relatedReports", chain(linked, "daily_report", "nightly_review"), "relatedIncidents", chain(linked, "incident"), "relatedArchitectReviews", chain(linked, "architecture_review"));
        }).toList();
    }

    private List<Map<String, Object>> chain(List<Map<String, Object>> nodes, String... types) { var allowed = List.of(types); return nodes.stream().filter(item -> allowed.contains(item.get("type"))).map(item -> map("id", item.get("id"), "label", item.get("label"), "type", item.get("type"), "importanceLevel", item.get("importanceLevel"))).toList(); }
    private Map<String, Object> edgeMap(KnowledgeEdge edge) { return map("id", edge.id(), "from_node_id", edge.from_node_id(), "to_node_id", edge.to_node_id(), "edge_type", edge.edge_type(), "confidence", edge.confidence(), "metadata", edge.metadata(), "created_at", edge.created_at()); }
    private Map<String, Object> emptyGraph() { return map("nodes", List.of(), "edges", List.of(), "stats", map("nodeCount", 0, "edgeCount", 0, "types", Map.of())); }
    private boolean hasType(KnowledgeNode a, KnowledgeNode b, String type) { return a != null && type.equals(a.node_type()) || b != null && type.equals(b.node_type()); }
    private boolean recent(String value) { try { return value != null && Duration.between(Instant.parse(value), Instant.now()).toHours() <= 24; } catch (Exception ignored) { return false; } }
    private String label(KnowledgeNode node) { String raw = node.external_ref() == null ? node.title() : node.external_ref().replace('\\', '/').substring(node.external_ref().replace('\\', '/').lastIndexOf('/') + 1); return raw.length() > 42 ? raw.substring(0, 39) + "..." : raw; }
    private String level(int score) { return score >= 10 ? "critical" : score >= 7 ? "high" : score >= 4 ? "medium" : "low"; }
    private String nodeReason(Map<String, Object> item) { return number(item, "degree") > 0 ? item.get("degree") + " graph links" : "low-degree operational memory"; }
    private String edgeReason(Map<String, Object> item) { return Boolean.TRUE.equals(item.get("isDecisionPath")) ? "decision path" : Boolean.TRUE.equals(item.get("isArchitectPath")) ? "Architect path" : Boolean.TRUE.equals(item.get("isIncidentPath")) ? "incident path" : String.valueOf(item.get("type")); }
    private int number(Map<String, Object> map, String key) { return map.get(key) instanceof Number n ? n.intValue() : 0; }
    private long countTrue(List<Map<String, Object>> values, String key) { return values.stream().filter(item -> Boolean.TRUE.equals(item.get(key))).count(); }
    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private Map<String, Object> sanitize(Map<String, Object> metadata) { var clean = new LinkedHashMap<String, Object>(); metadata.forEach((key, value) -> { String lower = key.toLowerCase(); if (!lower.contains("vault") && !lower.contains("absolute") && !lower.contains("secret") && !lower.contains("webhook")) clean.put(key, sanitizeValue(value)); }); return clean; }
    private Object sanitizeValue(Object value) {
        if (value instanceof String text && text.matches("^[A-Za-z]:\\\\.*")) { String normalized = text.replace('\\', '/'); return normalized.substring(normalized.lastIndexOf('/') + 1); }
        if (value instanceof Map<?, ?> nested) { var converted = new LinkedHashMap<String, Object>(); nested.forEach((key, item) -> converted.put(String.valueOf(key), item)); return sanitize(converted); }
        if (value instanceof List<?> list) return list.stream().map(this::sanitizeValue).toList();
        return value;
    }
    private Map<String, Object> map(Object... values) { var map = new LinkedHashMap<String, Object>(); for (int i = 0; i < values.length; i += 2) map.put(String.valueOf(values[i]), values[i + 1]); return map; }
}
