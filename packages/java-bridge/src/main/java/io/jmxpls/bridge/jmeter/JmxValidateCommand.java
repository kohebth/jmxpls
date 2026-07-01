package io.jmxpls.bridge.jmeter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class JmxValidateCommand {
    private static final Pattern TEST_CLASS = Pattern.compile("testclass=\"([^\"]+)\"");

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
            if (!xml.contains("<jmeterTestPlan") || !xml.contains("<hashTree")) {
                return new ValidationResult(false, "[{\"code\":\"JMX_BRIDGE_INVALID_JMX\",\"message\":\"file is not a recognizable JMeter test plan\"}]");
            }
            String missingPlugin = missingPluginClass(xml);
            if (!missingPlugin.isBlank()) {
                return new ValidationResult(false, "[{\"code\":\"JMX_JMETER_PLUGIN_CLASS_MISSING\",\"severity\":\"error\",\"message\":\"ClassNotFoundException: " + json(missingPlugin) + "\",\"fixSuggestion\":\"Install the missing JMeter plugin jar on the bridge classpath.\"}]");
            }
            return new ValidationResult(true, "[]");
        } catch (IOException error) {
            return new ValidationResult(false, "[{\"code\":\"JMX_BRIDGE_READ_FAILED\",\"message\":\"" + json(error.getMessage()) + "\"}]");
        }
    }

    private static String missingPluginClass(String xml) {
        Matcher matcher = TEST_CLASS.matcher(xml);
        while (matcher.find()) {
            String className = matcher.group(1);
            if (className == null || className.isBlank() || isBuiltInClassName(className)) {
                continue;
            }
            try {
                Class.forName(className);
            } catch (ClassNotFoundException error) {
                return className;
            }
        }
        return "";
    }

    private static boolean isBuiltInClassName(String className) {
        return !className.contains(".") || className.startsWith("org.apache.jmeter.") || className.startsWith("org.apache.jorphan.");
    }

    static String json(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    record ValidationResult(boolean valid, String diagnosticsJson) {
    }
}
