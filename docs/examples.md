# Examples

Open a plan, read `get_plan_language` in outline mode, query target nodes, apply a dry-run semantic patch, validate, save atomically, run JMeter in CLI mode, then analyze the JTL output.

To scaffold a basic HTTP API load-test flow in an open plan, dry-run the built-in baseline template first:

```json
{"name":"instantiate_template","arguments":{"name":"http_api_baseline","planId":"<planId>","domain":"api.example.test","path":"/ready","threads":25,"dryRun":true,"apply":true}}
```

Use the bearer-token and CSV login templates for common authenticated flows:

```json
{"name":"instantiate_template","arguments":{"name":"http_api_login_bearer_token","planId":"<planId>","domain":"api.example.test","loginPath":"/auth/login","authenticatedPath":"/v1/me","tokenVariable":"jwt","tokenJsonPath":"$.access_token","dryRun":true,"apply":true}}
```

```json
{"name":"instantiate_template","arguments":{"name":"csv_driven_login_flow","planId":"<planId>","csvFilename":"accounts.csv","usernameVariable":"email","passwordVariable":"secret","expectedStatus":"204","dryRun":true,"apply":true}}
```

Use load-profile templates to add a complete scheduled HTTP starter flow:

```json
{"name":"instantiate_template","arguments":{"name":"ramp_load_profile","planId":"<planId>","domain":"api.example.test","path":"/v2/ping","threads":75,"rampSec":600,"durationSec":1200,"targetThroughput":450,"dryRun":true,"apply":true}}
```
