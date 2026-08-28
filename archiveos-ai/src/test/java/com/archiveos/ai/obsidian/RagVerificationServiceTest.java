package com.archiveos.ai.obsidian;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.archiveos.ai.ecosystem.EcosystemService;
import com.archiveos.ai.notification.NotificationService;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RagVerificationServiceTest {
    @Test
    void requiresApprovalAndConsumesReadOnlyPlanExactlyOnce() {
        EcosystemService ecosystem = mock(EcosystemService.class);
        NotificationService notifications = mock(NotificationService.class);
        when(ecosystem.summary()).thenReturn(Map.of("services", Map.of(
                "market", Map.of("status", "HEALTHY"),
                "nexus", Map.of("status", "HEALTHY"))));
        RagVerificationService service = new RagVerificationService(ecosystem, notifications);
        RagVerificationService.VerificationPlan plan = service.createPlan("서비스가 지금 정상인가?");

        assertThat(plan.approvalRequired()).isTrue();
        assertThat(plan.externalEffect()).isFalse();
        assertThatThrownBy(() -> service.execute(plan.planId(), false, false))
                .isInstanceOf(IllegalArgumentException.class);

        RagVerificationService.VerificationReceipt receipt = service.execute(plan.planId(), true, false);
        assertThat(receipt.actualCheckPerformed()).isTrue();
        assertThat(receipt.evidenceType()).isEqualTo("LIVE");
        assertThat(receipt.apiResults()).extracting(result -> result.get("service"))
                .contains("ArchiveOS", "Archive-Market", "Archive-Nexus");
        assertThatThrownBy(() -> service.execute(plan.planId(), true, false))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void externalEffectPlanRequiresAdministrator() {
        RagVerificationService service = new RagVerificationService(
                mock(EcosystemService.class), mock(NotificationService.class));
        RagVerificationService.VerificationPlan plan = service.createPlan("Slack 테스트 메시지를 보내줘");

        assertThat(plan.externalEffect()).isTrue();
        assertThatThrownBy(() -> service.execute(plan.planId(), true, false))
                .isInstanceOf(SecurityException.class);
    }
}
