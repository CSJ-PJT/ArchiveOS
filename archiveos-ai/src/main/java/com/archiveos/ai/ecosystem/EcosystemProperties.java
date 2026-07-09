package com.archiveos.ai.ecosystem;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "archive")
public class EcosystemProperties {
    private Ecosystem ecosystem = new Ecosystem();
    private Integration integration = new Integration();

    public Ecosystem getEcosystem() { return ecosystem; }
    public void setEcosystem(Ecosystem ecosystem) { this.ecosystem = ecosystem; }
    public Integration getIntegration() { return integration; }
    public void setIntegration(Integration integration) { this.integration = integration; }

    public static class Ecosystem {
        private boolean enabled = true;
        private int refreshTimeoutMs = 3000;
        private Map<String, ServiceConfig> services = new LinkedHashMap<>();
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public int getRefreshTimeoutMs() { return refreshTimeoutMs; }
        public void setRefreshTimeoutMs(int refreshTimeoutMs) { this.refreshTimeoutMs = refreshTimeoutMs; }
        public Map<String, ServiceConfig> getServices() { return services; }
        public void setServices(Map<String, ServiceConfig> services) { this.services = services; }
    }

    public static class ServiceConfig {
        private boolean enabled = true;
        private String name;
        private String baseUrl;
        private String healthPath = "/actuator/health";
        private String summaryPath;
        private String outboxSummaryPath;
        private String routeSummaryPath;
        private String approvalRequiredPath;
        private String reconciliationSummaryPath;
        private String approvalCallbackPath;
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public String getHealthPath() { return healthPath; }
        public void setHealthPath(String healthPath) { this.healthPath = healthPath; }
        public String getSummaryPath() { return summaryPath; }
        public void setSummaryPath(String summaryPath) { this.summaryPath = summaryPath; }
        public String getOutboxSummaryPath() { return outboxSummaryPath; }
        public void setOutboxSummaryPath(String outboxSummaryPath) { this.outboxSummaryPath = outboxSummaryPath; }
        public String getRouteSummaryPath() { return routeSummaryPath; }
        public void setRouteSummaryPath(String routeSummaryPath) { this.routeSummaryPath = routeSummaryPath; }
        public String getApprovalRequiredPath() { return approvalRequiredPath; }
        public void setApprovalRequiredPath(String approvalRequiredPath) { this.approvalRequiredPath = approvalRequiredPath; }
        public String getReconciliationSummaryPath() { return reconciliationSummaryPath; }
        public void setReconciliationSummaryPath(String reconciliationSummaryPath) { this.reconciliationSummaryPath = reconciliationSummaryPath; }
        public String getApprovalCallbackPath() { return approvalCallbackPath; }
        public void setApprovalCallbackPath(String approvalCallbackPath) { this.approvalCallbackPath = approvalCallbackPath; }
    }

    public static class Integration {
        private boolean safeMode = true;
        private boolean allowExternalWrite = false;
        private Callback callback = new Callback();
        public boolean isSafeMode() { return safeMode; }
        public void setSafeMode(boolean safeMode) { this.safeMode = safeMode; }
        public boolean isAllowExternalWrite() { return allowExternalWrite; }
        public void setAllowExternalWrite(boolean allowExternalWrite) { this.allowExternalWrite = allowExternalWrite; }
        public Callback getCallback() { return callback; }
        public void setCallback(Callback callback) { this.callback = callback; }
    }

    public static class Callback {
        private boolean enabled = true;
        private int maxRetryCount = 5;
        private int retryDelaySeconds = 30;
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public int getMaxRetryCount() { return maxRetryCount; }
        public void setMaxRetryCount(int maxRetryCount) { this.maxRetryCount = maxRetryCount; }
        public int getRetryDelaySeconds() { return retryDelaySeconds; }
        public void setRetryDelaySeconds(int retryDelaySeconds) { this.retryDelaySeconds = retryDelaySeconds; }
    }
}
