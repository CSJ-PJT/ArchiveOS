# TypeScript backend to Java migration

## Target

Keep React and TypeScript in the frontend. Move backend business logic, scheduling, data access and integrations to Java.

## Remaining order

1. Queue events, run-once and nightly summary
2. Historian and knowledge graph
3. KPI and architecture review
4. Runtime diagnostics and local project actions
5. Legacy data access and proxy routes
6. Remove the Node service after Compose verification

## Removal rule

Delete a TypeScript backend module only after the Java replacement has an equivalent API contract, tests, frontend integration and Docker Compose verification.

## Guardrails

- Do not move frontend TypeScript to Java.
- Do not remove Node compatibility before the Java replacement is verified.
- Keep branding outside migration changes.
