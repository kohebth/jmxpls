package io.jmxpls.bridge.jmeter;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
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
        String home = configuredJMeterHome();
        String executable = jmeterExecutable(home);
        return new JMeterEnvironment(
            executable.isBlank() ? "jmeter-unconfigured" : "jmeter-configured",
            System.getProperty("java.version", "unknown"),
            fingerprint(classpath),
            home,
            executable
        );
    }

    private static String configuredJMeterHome() {
        String property = System.getProperty("jmxpls.jmeter.home", "");
        if (!property.isBlank()) {
            return property;
        }
        return System.getenv().getOrDefault("JMETER_HOME", "");
    }

    private static String jmeterExecutable(String home) {
        if (!home.isBlank()) {
            Path candidate = Path.of(home, "bin", executableName());
            if (Files.isExecutable(candidate)) {
                return candidate.toString();
            }
        }
        String path = System.getenv().getOrDefault("PATH", "");
        for (String entry : path.split(System.getProperty("path.separator"))) {
            if (entry.isBlank()) {
                continue;
            }
            Path candidate = Path.of(entry, executableName());
            if (Files.isExecutable(candidate)) {
                return candidate.toString();
            }
        }
        return "";
    }

    private static String executableName() {
        return System.getProperty("os.name", "").toLowerCase().contains("win") ? "jmeter.bat" : "jmeter";
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
