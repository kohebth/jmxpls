# Component Adapters

Built-in descriptors cover core plan structure, controllers, HTTP, data/config, samplers, timers, assertions, extractors, processors, and listeners. They power typed tools such as `add_http_request`, `add_csv_data_set`, `add_response_assertion`, and `add_backend_listener`.

Inspect descriptor coverage before generating a custom patch:

```json
{"name":"list_component_types","arguments":{"role":"sampler"}}
```

```json
{"name":"inspect_component_schema","arguments":{"type":"HTTPSamplerProxy"}}
```

Use `get_component_defaults` for starter fields, then apply semantic mutations. Unknown components fall back to raw preservation; prefer importing a descriptor catalog before using raw tools.
