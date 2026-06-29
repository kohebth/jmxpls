import type { Diagnostic } from "../model/diagnostics.js";
import type { BridgeClient, BridgeResponse } from "./bridge-client.js";

export type JMeterValidationMode = "load" | "loadSave" | "loadSaveReload";

export type JMeterValidationRequest = {
  path: string;
  mode: JMeterValidationMode;
};

export type JMeterValidationResult = {
  valid: boolean;
  mode: JMeterValidationMode;
  diagnostics: Diagnostic[];
};

export async function validateWithJMeter(
  bridge: BridgeClient,
  request: JMeterValidationRequest
): Promise<JMeterValidationResult> {
  const response: BridgeResponse<{ valid?: boolean }> = await bridge.request({
    id: `jmeter-validation:${request.mode}:${request.path}`,
    command: "validateJmx",
    payload: request
  });

  return {
    valid: response.success && response.data?.valid === true,
    mode: request.mode,
    diagnostics: response.diagnostics
  };
}
