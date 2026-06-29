package io.jmxpls.bridge;

public final class Main {
    private Main() {
    }

    public static void main(String[] args) throws Exception {
        new BridgeServer(System.in, System.out).run();
    }
}
