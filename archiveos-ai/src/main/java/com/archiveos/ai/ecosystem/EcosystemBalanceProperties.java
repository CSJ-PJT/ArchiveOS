package com.archiveos.ai.ecosystem;

import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Thresholds for synthetic ecosystem balance observations. */
@ConfigurationProperties(prefix = "archiveos.ecosystem.balance")
public class EcosystemBalanceProperties {
    private Margin market = new Margin(8, 18);
    private Margin nexus = new Margin(5, 12);
    private Margin logistics = new Margin(3, 10);
    private Margin ledger = new Margin(4, 12);
    private Margin archiveos = new Margin(0, 8);
    private int backlogWarning = 20;
    private int capacityWarningPercent = 90;
    private int profitConcentrationPercent = 55;

    public Margin getMarket() { return market; } public void setMarket(Margin value) { market = value; }
    public Margin getNexus() { return nexus; } public void setNexus(Margin value) { nexus = value; }
    public Margin getLogistics() { return logistics; } public void setLogistics(Margin value) { logistics = value; }
    public Margin getLedger() { return ledger; } public void setLedger(Margin value) { ledger = value; }
    public Margin getArchiveos() { return archiveos; } public void setArchiveos(Margin value) { archiveos = value; }
    public int getBacklogWarning() { return backlogWarning; } public void setBacklogWarning(int value) { backlogWarning = value; }
    public int getCapacityWarningPercent() { return capacityWarningPercent; } public void setCapacityWarningPercent(int value) { capacityWarningPercent = value; }
    public int getProfitConcentrationPercent() { return profitConcentrationPercent; } public void setProfitConcentrationPercent(int value) { profitConcentrationPercent = value; }

    public Margin marginFor(String key) {
        return switch (key) {
            case "market" -> market;
            case "nexus" -> nexus;
            case "logitics", "logistics" -> logistics;
            case "ledger" -> ledger;
            default -> archiveos;
        };
    }

    public static class Margin {
        private BigDecimal minMargin;
        private BigDecimal maxMargin;
        public Margin() { this(BigDecimal.ZERO, BigDecimal.ZERO); }
        public Margin(int minMargin, int maxMargin) { this(BigDecimal.valueOf(minMargin), BigDecimal.valueOf(maxMargin)); }
        public Margin(BigDecimal minMargin, BigDecimal maxMargin) { this.minMargin = minMargin; this.maxMargin = maxMargin; }
        public BigDecimal getMinMargin() { return minMargin; } public void setMinMargin(BigDecimal value) { minMargin = value; }
        public BigDecimal getMaxMargin() { return maxMargin; } public void setMaxMargin(BigDecimal value) { maxMargin = value; }
    }
}
