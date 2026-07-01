package io.jmxpls.bridge;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
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

    @Test
    void validatesReadableJmxFiles() throws Exception {
        Path plan = Files.createTempFile("jmxpls-bridge-", ".jmx");
        Files.writeString(plan, "<jmeterTestPlan><hashTree/></jmeterTestPlan>");

        String response = new BridgeServer(System.in, System.out).handle("{\"id\":\"4\",\"command\":\"validateJmx\",\"path\":\"" + plan + "\"}");

        assertTrue(response.contains("\"success\":true"));
        assertTrue(response.contains("\"valid\":true"));
    }

    @Test
    void reportsInvalidJmxFiles() throws Exception {
        Path plan = Files.createTempFile("jmxpls-bridge-invalid-", ".jmx");
        Files.writeString(plan, "<notJMeter/>");

        String response = new BridgeServer(System.in, System.out).handle("{\"id\":\"5\",\"command\":\"validateJmx\",\"path\":\"" + plan + "\"}");

        assertTrue(response.contains("\"success\":true"));
        assertTrue(response.contains("\"valid\":false"));
        assertTrue(response.contains("JMX_BRIDGE_INVALID_JMX"));
    }
}
