package io.jmxpls.bridge.jmeter;

public final class JmxSaveCommand {
    public String execute(String path) {
        return "{\"path\":\"" + path + "\",\"saved\":false,\"reason\":\"jmeter-unconfigured\"}";
    }
}
