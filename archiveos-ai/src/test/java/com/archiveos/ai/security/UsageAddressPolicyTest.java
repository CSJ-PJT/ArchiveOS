package com.archiveos.ai.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class UsageAddressPolicyTest {
    @Test
    void excludesRequestedAndInternalNetworks() {
        assertThat(UsageAddressPolicy.isExcluded("106.101.6.52")).isTrue();
        assertThat(UsageAddressPolicy.isExcluded("172.20.0.4")).isTrue();
        assertThat(UsageAddressPolicy.isExcluded("10.0.0.1")).isTrue();
        assertThat(UsageAddressPolicy.isExcluded("192.168.1.1")).isTrue();
        assertThat(UsageAddressPolicy.isExcluded("127.0.0.1")).isTrue();
        assertThat(UsageAddressPolicy.isExcluded("::1")).isTrue();
    }

    @Test
    void keepsExternalAddresses() {
        assertThat(UsageAddressPolicy.isExcluded("203.0.113.21")).isFalse();
        assertThat(UsageAddressPolicy.isExcluded("8.8.8.8")).isFalse();
    }
}
