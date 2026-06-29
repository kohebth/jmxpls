package io.jmxpls.bridge.protocol;

public record BridgeResponse(String id, boolean success, String dataJson, String diagnosticsJson) {
}
