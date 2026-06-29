package io.jmxpls.bridge.protocol;

public record BridgeRequest(String id, String command, String payloadJson) {
}
