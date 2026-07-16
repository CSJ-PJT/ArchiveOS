package com.archiveos.ai.obsidian;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Per-instance fixed-window guard for interactive RAG endpoints. It deliberately
 * keys on the authenticated principal when present and never trusts forwarded IP
 * headers. Multi-instance deployments need a shared limiter at the edge.
 */
@Service
public class RagRateLimitService {
    private static final long WINDOW_SECONDS = 60L;
    private final Clock clock;
    private final int searchLimit;
    private final int askLimit;
    private final Map<String, Bucket> buckets = new HashMap<>();

    @Autowired
    public RagRateLimitService(
            @Value("${archive.rag.rate-limit.search-per-minute:60}") int searchLimit,
            @Value("${archive.rag.rate-limit.ask-per-minute:12}") int askLimit) {
        this(Clock.systemUTC(), searchLimit, askLimit);
    }

    RagRateLimitService(Clock clock, int searchLimit, int askLimit) {
        this.clock = clock;
        this.searchLimit = Math.max(1, searchLimit);
        this.askLimit = Math.max(1, askLimit);
    }

    public synchronized Decision check(String operation, String principalKey) {
        long now = clock.instant().getEpochSecond();
        long window = Math.floorDiv(now, WINDOW_SECONDS);
        String key = operation + "|" + principalKey;
        Bucket bucket = buckets.get(key);
        if (bucket == null || bucket.window() != window) {
            buckets.put(key, new Bucket(window, 1));
            return Decision.permitted();
        }
        if (bucket.count() >= limitFor(operation)) {
            return Decision.limited(Math.max(1L, ((window + 1) * WINDOW_SECONDS) - now));
        }
        buckets.put(key, new Bucket(window, bucket.count() + 1));
        return Decision.permitted();
    }

    private int limitFor(String operation) {
        return "ask".equals(operation) ? askLimit : searchLimit;
    }

    private record Bucket(long window, int count) {}
    public record Decision(boolean allowed, long retryAfterSeconds) {
        static Decision permitted() { return new Decision(true, 0); }
        static Decision limited(long retryAfterSeconds) { return new Decision(false, retryAfterSeconds); }
    }
}
