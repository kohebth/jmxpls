package io.jmxpls.bridge;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class MainTest {
    @Test
    void handlesPing() {
        String response = new BridgeServer(System.in, System.out).handle("{\"id\":\"1\",\"command\":\"ping\"}");

        assertTrue(response.contains("\"success\":true"));
        assertTrue(response.contains("\"pong\":true"));
    }

    @Test
    void handlesComponentCatalog() {
        String response = new BridgeServer(System.in, System.out).handle("{\"id\":\"2\",\"command\":\"componentCatalog\"}");

        assertTrue(response.contains("\"success\":true"));
        assertTrue(response.contains("\"source\":\"jmeter-unconfigured\""));
    }

    @Test
    void rejectsUnknownCommands() {
        String response = new BridgeServer(System.in, System.out).handle("{\"id\":\"3\",\"command\":\"missing\"}");

        assertTrue(response.contains("\"success\":false"));
        assertTrue(response.contains("JMX_BRIDGE_UNKNOWN_COMMAND"));
    }
}
