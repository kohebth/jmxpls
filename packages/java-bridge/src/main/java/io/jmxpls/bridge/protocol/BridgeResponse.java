package io.jmxpls.bridge.protocol;

public record BridgeResponse(String id, boolean success, String dataJson, String diagnosticsJson) {
    public static BridgeResponse success(String id, String dataJson) {
        return new BridgeResponse(id, true, dataJson, "[]");
    }

    public static BridgeResponse failure(String id, String code, String message) {
        return new BridgeResponse(
                id,
                false,
                "null",
                "[{\"code\":\"" + escape(code) + "\",\"severity\":\"error\",\"message\":\"" + escape(message) + "\"}]"
        );
    }

    public String toJson() {
        return "{\"id\":\"" + escape(id) + "\",\"success\":" + success + ",\"data\":" + dataJson + ",\"diagnostics\":" + diagnosticsJson + "}";
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
