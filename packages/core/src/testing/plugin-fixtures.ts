export type PluginFixture = {
  path: string;
  requiresJar: boolean;
  expectedClass: string;
};

export const pluginFixtures: PluginFixture[] = [
  { path: "fixtures/plugins/unknown-plugin.jmx", requiresJar: false, expectedClass: "com.example.UnknownPlugin" },
  { path: "fixtures/plugins/known-plugin-with-jar.jmx", requiresJar: true, expectedClass: "kg.apc.jmeter.threads.UltimateThreadGroup" }
];
