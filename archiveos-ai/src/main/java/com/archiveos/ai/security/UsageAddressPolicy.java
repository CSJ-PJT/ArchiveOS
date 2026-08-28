package com.archiveos.ai.security;

import java.net.InetAddress;
import java.net.UnknownHostException;

public final class UsageAddressPolicy {
    private UsageAddressPolicy() { }

    public static boolean isExcluded(String value) {
        if (value == null || value.isBlank()) return true;
        try {
            byte[] address = InetAddress.getByName(value.trim()).getAddress();
            if (address.length == 4) {
                int first = address[0] & 0xff;
                int second = address[1] & 0xff;
                boolean archiveServer = first == 161
                        && second == 33
                        && (address[2] & 0xff) == 17
                        && (address[3] & 0xff) == 84;
                return first == 0
                        || first == 10
                        || first == 127
                        || first == 172
                        || (first == 192 && second == 168)
                        || (first == 169 && second == 254)
                        || (first == 100 && second >= 64 && second <= 127)
                        || (first == 106 && second == 101)
                        || archiveServer;
            }
            int first = address[0] & 0xff;
            int second = address[1] & 0xff;
            boolean loopback = true;
            for (int index = 0; index < 15; index += 1) loopback &= address[index] == 0;
            return loopback && address[15] == 1
                    || (first & 0xfe) == 0xfc
                    || first == 0xfe && (second & 0xc0) == 0x80;
        } catch (UnknownHostException error) {
            return true;
        }
    }
}
