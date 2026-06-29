import type { BridgeClient } from "../jmeter/bridge-client.js";
import { validateWithJMeter, type JMeterValidationMode, type JMeterValidationResult } from "../jmeter/jmeter-validation.js";

export async function validatePlanWithJMeter(bridge: BridgeClient, path: string, mode: JMeterValidationMode = "loadSaveReload"): Promise<JMeterValidationResult> {
  return await validateWithJMeter(bridge, { path, mode });
}
