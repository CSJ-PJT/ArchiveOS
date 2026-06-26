package com.archiveos.ai.rpa;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class RpaDecisionRequestTest {
    @Test
    void acceptsKnownPmDecisionActions() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();

            assertThat(validator.validate(new RpaDecisionRequest("approve", "ok", "pm"))).isEmpty();
            assertThat(validator.validate(new RpaDecisionRequest("reject", "not safe", "pm"))).isEmpty();
            assertThat(validator.validate(new RpaDecisionRequest("hold", "wait", "pm"))).isEmpty();
            assertThat(validator.validate(new RpaDecisionRequest("request_retry", "revise", "pm"))).isEmpty();
        }
    }

    @Test
    void rejectsUnknownPmDecisionActions() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();

            assertThat(validator.validate(new RpaDecisionRequest("execute", "run it", "pm"))).isNotEmpty();
        }
    }
}
