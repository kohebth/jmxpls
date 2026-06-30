# Examples

Open a plan, read `get_plan_language` in outline mode, query target nodes, apply a dry-run semantic patch, validate, save atomically, run JMeter in CLI mode, then analyze the JTL output.

To scaffold a basic HTTP API load-test flow in an open plan, dry-run the built-in baseline template first:

```json
{"name":"instantiate_template","arguments":{"name":"http_api_baseline","planId":"<planId>","dryRun":true,"apply":true}}
```
