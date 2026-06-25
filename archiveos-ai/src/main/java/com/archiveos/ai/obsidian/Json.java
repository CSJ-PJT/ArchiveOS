package com.archiveos.ai.obsidian;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

final class Json {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Json() {}

    static String write(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("Failed to serialize JSON metadata", error);
        }
    }
}
