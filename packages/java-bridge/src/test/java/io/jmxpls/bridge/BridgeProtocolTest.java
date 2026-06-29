package io.jmxpls.bridge;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.jmxpls.bridge.protocol.BridgeRequest;
import io.jmxpls.bridge.protocol.BridgeResponse;
import org.junit.jupiter.api.Test;

final class BridgeProtocolTest {
    @Test
    void parsesBridgeRequests() {
        BridgeRequest request = BridgeRequest.parse("{\"id\":\"abc\",\"command\":\"validateJmx\",\"path\":\"plan.jmx\"}");

        assertEquals("abc", request.id());
        assertEquals("validateJmx", request.command());
        assertEquals("plan.jmx", request.stringField("path", ""));
    }

    @Test
    void serializesSuccessResponses() {
        String json = BridgeResponse.success("abc", "{\"ok\":true}").toJson();

        assertTrue(json.contains("\"id\":\"abc\""));
        assertTrue(json.contains("\"success\":true"));
        assertTrue(json.contains("\"ok\":true"));
    }

    @Test
    void serializesFailureResponses() {
        String json = BridgeResponse.failure("abc", "CODE", "message").toJson();

        assertTrue(json.contains("\"success\":false"));
        assertTrue(json.contains("\"code\":\"CODE\""));
        assertTrue(json.contains("\"message\":\"message\""));
    }
}
