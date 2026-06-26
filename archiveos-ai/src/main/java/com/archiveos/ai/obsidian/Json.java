package com.archiveos.ai.obsidian;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

public final class Json {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Json() {}

    public static String write(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("Failed to serialize JSON metadata", error);
        }
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> readObject(String value) {
        if (value == null || value.isBlank()) return Map.of();
        try {
            Object parsed = MAPPER.readValue(value, Object.class);
            return parsed instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
        } catch (JsonProcessingException error) {
            return Map.of("parse_error", "metadata JSON could not be parsed");
        }
    }
}
