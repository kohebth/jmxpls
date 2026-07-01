# Examples

Open a plan, inspect compact resources, apply a semantic change, validate, save atomically, plan a JMeter run, then analyze JTL output.

## Open, Mutate, Validate, Save

```json
{"name":"open_plan","arguments":{"path":"/workspace/plans/load-test.jmx"}}
```

Read the returned `defaultResource`, then page the tree:

```json
{"name":"list_tree","arguments":{"planId":"<planId>","limit":50,"depth":2}}
```

Disable a node without editing XML:

```json
{"name":"disable_node","arguments":{"planId":"<planId>","nodeId":"<nodeId>"}}
```

Review the semantic diff and save:

```json
{"uri":"jmxpls://plans/<planId>/diff/semantic"}
```

```json
{"name":"validate_plan","arguments":{"planId":"<planId>"}}
```

```json
{"name":"save_plan","arguments":{"planId":"<planId>","backup":true}}
```

## Templates

Inspect template metadata first to avoid guessing fields for a new template:

```json
{"name":"get_template","arguments":{"name":"http_api_baseline"}}
```

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

Quickly scaffold a full CRUD API scenario and a JDBC smoke check:

```json
{"name":"instantiate_template","arguments":{"name":"crud_api_flow","planId":"<planId>","domain":"api.example.test","resourceBasePath":"/items","threads":5,"createBody":"{\"name\":\"new-item\"}","updateBody":"{\"name\":\"updated-item\"}","dryRun":true,"apply":true}}
```

```json
{"name":"instantiate_template","arguments":{"name":"jdbc_query_test","planId":"<planId>","dbUrl":"jdbc:h2:mem:sample","query":"SELECT 1","dryRun":true,"apply":true}}
```

For plugin-adjacent starters, use:

```json
{"name":"instantiate_template","arguments":{"name":"jms_point_to_point_test","planId":"<planId>","destination":"test.queue","message":"hello-world","dryRun":true,"apply":true}}
```

```json
{"name":"instantiate_template","arguments":{"name":"tcp_smoke_test","planId":"<planId>","server":"localhost","text":"ping","port":80,"dryRun":true,"apply":true}}
```

## Run and Analyze

```json
{"name":"run_jmeter","arguments":{"planPath":"/workspace/plans/load-test.jmx","jtlPath":"/workspace/results/load-test.jtl"}}
```

```json
{"name":"analyze_jtl","arguments":{"jtlPath":"/workspace/results/load-test.jtl"}}
```
