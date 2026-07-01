package io.jmxpls.bridge.jmeter;

public final class RoundTripCommand {
    public String execute(String path) {
        JmxValidateCommand.ValidationResult result = JmxValidateCommand.validate(path);
        return "{\"path\":\"" + JmxValidateCommand.json(path) + "\",\"valid\":" + result.valid() + ",\"roundTripValid\":" + result.valid() + ",\"diagnostics\":" + result.diagnosticsJson() + "}";
    }
}
