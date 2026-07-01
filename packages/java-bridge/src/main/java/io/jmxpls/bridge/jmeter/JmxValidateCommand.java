package io.jmxpls.bridge.jmeter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class JmxValidateCommand {
    public String execute(String path) {
        ValidationResult result = validate(path);
        return "{\"path\":\"" + json(path) + "\",\"valid\":" + result.valid + ",\"diagnostics\":" + result.diagnosticsJson + "}";
    }

    static ValidationResult validate(String path) {
        if (path == null || path.isBlank()) {
            return new ValidationResult(false, "[{\"code\":\"JMX_BRIDGE_PATH_REQUIRED\",\"message\":\"path is required\"}]");
        }
        try {
            String xml = Files.readString(Path.of(path));
            boolean valid = xml.contains("<jmeterTestPlan") && xml.contains("<hashTree");
            String diagnostics = valid ? "[]" : "[{\"code\":\"JMX_BRIDGE_INVALID_JMX\",\"message\":\"file is not a recognizable JMeter test plan\"}]";
            return new ValidationResult(valid, diagnostics);
        } catch (IOException error) {
            return new ValidationResult(false, "[{\"code\":\"JMX_BRIDGE_READ_FAILED\",\"message\":\"" + json(error.getMessage()) + "\"}]");
        }
    }

    static String json(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    record ValidationResult(boolean valid, String diagnosticsJson) {
    }
}
