package io.jmxpls.bridge;

import io.jmxpls.bridge.jmeter.JMeterBootstrap;
import io.jmxpls.bridge.jmeter.JmxLoadCommand;
import io.jmxpls.bridge.jmeter.JmxSaveCommand;
import io.jmxpls.bridge.jmeter.JmxValidateCommand;
import io.jmxpls.bridge.jmeter.RoundTripCommand;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

public final class BridgeServer {
    private final BufferedReader input;
    private final PrintWriter output;

    public BridgeServer(InputStream input, OutputStream output) {
        this.input = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8));
        this.output = new PrintWriter(output, true, StandardCharsets.UTF_8);
    }

    public void run() throws IOException {
        String line;
        while ((line = input.readLine()) != null) {
            output.println(handle(line));
        }
    }

    String handle(String requestJson) {
        String id = extractString(requestJson, "id", "unknown");
        String command = extractString(requestJson, "command", "unknown");
        String path = extractString(requestJson, "path", "");

        return switch (command) {
            case "ping" -> success(id, "{\"pong\":true}");
            case "environment" -> success(id, JMeterBootstrap.environmentJson());
            case "loadJmx" -> success(id, new JmxLoadCommand().execute(path));
            case "saveJmx" -> success(id, new JmxSaveCommand().execute(path));
            case "validateJmx" -> success(id, new JmxValidateCommand().execute(path));
            case "roundTripJmx" -> success(id, new RoundTripCommand().execute(path));
            default -> failure(id, "JMX_BRIDGE_UNKNOWN_COMMAND", "Unknown bridge command: " + command);
        };
    }

    private static String success(String id, String dataJson) {
        return "{\"id\":\"" + escape(id) + "\",\"success\":true,\"data\":" + dataJson + ",\"diagnostics\":[]}";
    }

    private static String failure(String id, String code, String message) {
        return "{\"id\":\"" + escape(id) + "\",\"success\":false,\"diagnostics\":[{\"code\":\"" + escape(code) + "\",\"severity\":\"error\",\"message\":\"" + escape(message) + "\"}]}";
    }

    private static String extractString(String json, String field, String fallback) {
        String needle = "\"" + field + "\"";
        int fieldIndex = json.indexOf(needle);
        if (fieldIndex < 0) {
            return fallback;
        }
        int colon = json.indexOf(':', fieldIndex + needle.length());
        int start = json.indexOf('"', colon + 1);
        int end = json.indexOf('"', start + 1);
        if (colon < 0 || start < 0 || end < 0) {
            return fallback;
        }
        return json.substring(start + 1, end);
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
