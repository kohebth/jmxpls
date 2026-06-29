package io.jmxpls.bridge.jmeter;

public final class JmxLoadCommand {
    public String execute(String path) {
        return "{\"path\":\"" + path + "\",\"loaded\":false,\"reason\":\"jmeter-unconfigured\"}";
    }
}
