package io.jmxpls.bridge.protocol;

public record BridgeRequest(String id, String command, String payloadJson) {
    public static BridgeRequest parse(String requestJson) {
        return new BridgeRequest(
                extractString(requestJson, "id", "unknown"),
                extractString(requestJson, "command", "unknown"),
                requestJson
        );
    }

    public String stringField(String field, String fallback) {
        return extractString(payloadJson, field, fallback);
    }

    private static String extractString(String json, String field, String fallback) {
        String needle = "\"" + field + "\"";
        int fieldIndex = json.indexOf(needle);
        if (fieldIndex < 0) {
            return fallback;
        }
        int colon = json.indexOf(':', fieldIndex + needle.length());
        if (colon < 0) {
            return fallback;
        }
        int start = json.indexOf('"', colon + 1);
        int end = start < 0 ? -1 : json.indexOf('"', start + 1);
        if (start < 0 || end < 0) {
            return fallback;
        }
        return json.substring(start + 1, end);
    }
}
