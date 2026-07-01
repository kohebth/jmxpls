# Plugin Support

Unknown plugin nodes are preserved by default during open, semantic mutation, move, save, and reload. The semantic model keeps raw references so unsupported elements can be inspected without losing custom properties.

Use built-in descriptors for known components and dynamic catalogs for plugin-aware workflows:

```json
{"name":"import_component_catalog","arguments":{"path":"/workspace/catalogs/custom-components.json"}}
```

Unknown components produce `JMX_UNKNOWN_COMPONENT` diagnostics with a suggestion to load plugin jars, import a component catalog, or use raw tools when no descriptor exists. Use `get_raw_element`, `get_raw_properties`, and `update_raw_property` only when a typed tool or descriptor cannot represent the plugin field.

JMeter-backed validation depends on the Java bridge and the JMeter/plugin classpath available to that bridge. Configure `JMXPLS_JAVA_BRIDGE_JAR` before treating `validate_with_jmeter` as authoritative for plugin-heavy plans.
