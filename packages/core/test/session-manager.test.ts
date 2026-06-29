import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { SessionManager } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

describe("SessionManager", () => {
  it("opens, lists, mutates, and closes plans", async () => {
    const manager = new SessionManager();
    const session = await manager.openPlan(resolve(root, "fixtures/jmx/minimal.jmx"));

    expect(session.revision).toBe(0);
    expect(manager.listOpenPlans()).toHaveLength(1);

    session.markMutated("test mutation");
    expect(session.revision).toBe(1);
    expect(session.dirty).toBe(true);

    session.markSaved();
    expect(session.dirty).toBe(false);
    expect(manager.closePlan(session.planId)).toBe(true);
  });
});
