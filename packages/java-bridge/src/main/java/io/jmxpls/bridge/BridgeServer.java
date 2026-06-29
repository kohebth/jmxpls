package io.jmxpls.bridge;

import io.jmxpls.bridge.jmeter.ComponentCatalogCommand;
import io.jmxpls.bridge.jmeter.JMeterBootstrap;
import io.jmxpls.bridge.jmeter.JmxLoadCommand;
import io.jmxpls.bridge.jmeter.JmxSaveCommand;
import io.jmxpls.bridge.jmeter.JmxValidateCommand;
import io.jmxpls.bridge.jmeter.RoundTripCommand;
import io.jmxpls.bridge.protocol.BridgeRequest;
import io.jmxpls.bridge.protocol.BridgeResponse;
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
        BridgeRequest request = BridgeRequest.parse(requestJson);
        String path = request.stringField("path", "");

        return switch (request.command()) {
            case "ping" -> success(request.id(), "{\"pong\":true}");
            case "environment" -> success(request.id(), JMeterBootstrap.environmentJson());
            case "componentCatalog" -> success(request.id(), new ComponentCatalogCommand().execute());
            case "loadJmx" -> success(request.id(), new JmxLoadCommand().execute(path));
            case "saveJmx" -> success(request.id(), new JmxSaveCommand().execute(path));
            case "validateJmx" -> success(request.id(), new JmxValidateCommand().execute(path));
            case "roundTripJmx" -> success(request.id(), new RoundTripCommand().execute(path));
            default -> failure(request.id(), "JMX_BRIDGE_UNKNOWN_COMMAND", "Unknown bridge command: " + request.command());
        };
    }

    private static String success(String id, String dataJson) {
        return BridgeResponse.success(id, dataJson).toJson();
    }

    private static String failure(String id, String code, String message) {
        return BridgeResponse.failure(id, code, message).toJson();
    }
}
