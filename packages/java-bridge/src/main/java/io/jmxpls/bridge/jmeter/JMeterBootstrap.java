package io.jmxpls.bridge.jmeter;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class JMeterBootstrap {
    private JMeterBootstrap() {
    }

    public static String environmentJson() {
        return environment().toJson();
    }

    public static JMeterEnvironment environment() {
        String classpath = System.getProperty("java.class.path", "");
        return new JMeterEnvironment(
            "jmeter-unconfigured",
            System.getProperty("java.version", "unknown"),
            fingerprint(classpath)
        );
    }

    private static String fingerprint(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (int index = 0; index < Math.min(hash.length, 8); index++) {
                builder.append(String.format("%02x", hash[index]));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException error) {
            return "unavailable";
        }
    }
}
