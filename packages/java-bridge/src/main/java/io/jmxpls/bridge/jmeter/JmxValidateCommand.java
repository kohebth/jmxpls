package io.jmxpls.bridge.jmeter;

public final class JmxValidateCommand {
    public String execute(String path) {
        return "{\"path\":\"" + path + "\",\"valid\":false,\"reason\":\"jmeter-unconfigured\"}";
    }
}
