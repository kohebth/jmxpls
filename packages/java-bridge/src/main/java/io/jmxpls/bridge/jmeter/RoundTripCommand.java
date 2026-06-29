package io.jmxpls.bridge.jmeter;

public final class RoundTripCommand {
    public String execute(String path) {
        return "{\"path\":\"" + path + "\",\"roundTripValid\":false,\"reason\":\"jmeter-unconfigured\"}";
    }
}
