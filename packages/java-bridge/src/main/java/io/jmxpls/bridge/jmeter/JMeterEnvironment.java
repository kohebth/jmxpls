package io.jmxpls.bridge.jmeter;

public record JMeterEnvironment(String status, String javaVersion, String classpathFingerprint, String jmeterHome, String executable) {
    public String toJson() {
        return "{\"status\":\"" + status + "\",\"javaVersion\":\"" + javaVersion + "\",\"classpathFingerprint\":\"" + classpathFingerprint + "\",\"jmeterHome\":\"" + json(jmeterHome) + "\",\"executable\":\"" + json(executable) + "\"}";
    }

    private static String json(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
