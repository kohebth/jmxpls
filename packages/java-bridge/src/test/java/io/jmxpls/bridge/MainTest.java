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
    void reportsConfiguredJMeterHome() throws Exception {
        Path home = Files.createTempDirectory("jmxpls-jmeter-home-");
        Path bin = Files.createDirectories(home.resolve("bin"));
        Path executable = bin.resolve(System.getProperty("os.name", "").toLowerCase().contains("win") ? "jmeter.bat" : "jmeter");
        Files.writeString(executable, "");
        executable.toFile().setExecutable(true);
        String previous = System.getProperty("jmxpls.jmeter.home");
        System.setProperty("jmxpls.jmeter.home", home.toString());
        try {
            String response = new BridgeServer(System.in, System.out).handle("{\"id\":\"env\",\"command\":\"environment\"}");

            assertTrue(response.contains("\"status\":\"jmeter-configured\""));
            assertTrue(response.contains("jmeter"));
        } finally {
            if (previous == null) {
                System.clearProperty("jmxpls.jmeter.home");
            } else {
                System.setProperty("jmxpls.jmeter.home", previous);
            }
        }
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

    @Test
    void reportsMissingPluginClasses() throws Exception {
        Path plan = Files.createTempFile("jmxpls-bridge-plugin-", ".jmx");
        Files.writeString(plan, "<jmeterTestPlan><hashTree><com.example.UnknownPlugin testclass=\"com.example.UnknownPlugin\" /></hashTree></jmeterTestPlan>");

        String response = new BridgeServer(System.in, System.out).handle("{\"id\":\"6\",\"command\":\"validateJmx\",\"path\":\"" + plan + "\"}");

        assertTrue(response.contains("\"success\":true"));
        assertTrue(response.contains("\"valid\":false"));
        assertTrue(response.contains("JMX_JMETER_PLUGIN_CLASS_MISSING"));
    }
}
