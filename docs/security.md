# Security

Workspace guards restrict file access to configured roots. By default, the runtime allows `process.cwd()` and the OS temp directory; set `JMXPLS_WORKSPACE_ROOTS` to a colon-separated allowlist for MCP clients.

Execution tools prepare JMeter command records with argument arrays and reject unsafe executables or arguments. Allowed JMeter executables are `jmeter`, `jmeter.bat`, and `ApacheJMeter.jar`; shell commands such as `/bin/sh` are rejected.

Mutation, save, run, and report tools are recorded in `jmxpls://audit`. Secret-like keys are redacted from audit data and summaries. Script text is labeled with `JMX_UNTRUSTED_SCRIPT_TEXT` diagnostics so agents can treat embedded Groovy/JSR223 code as review-required content.

Prefer semantic and Plan Language tools. Raw tools are reserved for plugin recovery or unsupported components and should be dry-run first.
