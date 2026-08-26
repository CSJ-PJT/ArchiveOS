package com.archiveos.ai.integration.ledger;

import com.archiveos.ai.ecosystem.EcosystemProperties;
import com.archiveos.ai.ecosystem.EcosystemServiceClient;
import java.util.LinkedHashMap;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class LedgerClientTest {

    @Test
    void usesLedgerSpecificTimeoutWithoutSlowingOtherServiceClients() {
        EcosystemProperties properties = new EcosystemProperties();
        properties.getEcosystem().setRefreshTimeoutMs(3000);

        EcosystemProperties.ServiceConfig ledger = new EcosystemProperties.ServiceConfig();
        ledger.setBaseUrl("http://ledger.test");
        ledger.setSummaryPath("/api/operations/summary");
        ledger.setRequestTimeoutMs(6000);
        properties.getEcosystem().setServices(new LinkedHashMap<>());
        properties.getEcosystem().getServices().put("ledger", ledger);

        EcosystemServiceClient client = Mockito.mock(EcosystemServiceClient.class);
        LedgerClient ledgerClient = new LedgerClient(properties, client, "");

        ledgerClient.operationsSummary();

        Mockito.verify(client).get("http://ledger.test", "/api/operations/summary", 6000);
    }
}
