package com.archiveos.ai.obsidian;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.security.Principal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class RagRateLimitServiceTest {
    @Test
    void separatesPrincipalsAndResetsAtTheNextWindow() {
        MutableClock clock = new MutableClock("2026-07-16T00:00:30Z");
        RagRateLimitService limiter = new RagRateLimitService(clock, 2, 1);

        assertThat(limiter.check("search", "principal:alpha").allowed()).isTrue();
        assertThat(limiter.check("search", "principal:alpha").allowed()).isTrue();
        RagRateLimitService.Decision blocked = limiter.check("search", "principal:alpha");
        assertThat(blocked.allowed()).isFalse();
        assertThat(blocked.retryAfterSeconds()).isEqualTo(30);
        assertThat(limiter.check("search", "principal:beta").allowed()).isTrue();

        clock.set("2026-07-16T00:01:00Z");
        assertThat(limiter.check("search", "principal:alpha").allowed()).isTrue();
    }

    @Test
    void returns429ForSearchAndAskWithoutCallingTheModelAgain() {
        MutableClock clock = new MutableClock("2026-07-16T00:00:00Z");
        RagRateLimitService limiter = new RagRateLimitService(clock, 1, 1);
        ObsidianRagService rag = mock(ObsidianRagService.class);
        when(rag.search("status", 10)).thenReturn(List.of());
        when(rag.answer("question", null)).thenReturn(new RagAnswer("answer", List.of()));
        ObsidianRagController controller = new ObsidianRagController(rag, limiter);
        Principal alpha = () -> "alpha";

        var search = controller.search("status", 10, alpha, request());
        var limitedSearch = controller.search("status", 10, alpha, request());
        var ask = controller.ask(new ObsidianRagController.RagAskRequest("question", null), alpha, request());
        var limitedAsk = controller.ask(new ObsidianRagController.RagAskRequest("question", null), alpha, request());

        assertThat(search.getStatusCode().value()).isEqualTo(200);
        assertThat(search.getBody()).containsEntry("status", "SEARCH_ONLY");
        assertThat(limitedSearch.getStatusCode().value()).isEqualTo(429);
        assertThat(limitedSearch.getHeaders().getFirst("Retry-After")).isEqualTo("60");
        assertThat(ask.getStatusCode().value()).isEqualTo(200);
        assertThat(limitedAsk.getStatusCode().value()).isEqualTo(429);
    }

    private MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        return request;
    }

    private static final class MutableClock extends Clock {
        private final AtomicReference<Instant> instant;

        private MutableClock(String instant) {
            this.instant = new AtomicReference<>(Instant.parse(instant));
        }

        void set(String value) {
            instant.set(Instant.parse(value));
        }

        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return instant.get(); }
    }
}
