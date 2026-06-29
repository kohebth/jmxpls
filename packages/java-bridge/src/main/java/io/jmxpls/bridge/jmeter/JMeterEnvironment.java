package io.jmxpls.bridge.jmeter;

public record JMeterEnvironment(String status, String javaVersion, String classpathFingerprint) {
    public String toJson() {
        return "{\"status\":\"" + status + "\",\"javaVersion\":\"" + javaVersion + "\",\"classpathFingerprint\":\"" + classpathFingerprint + "\"}";
    }
}
