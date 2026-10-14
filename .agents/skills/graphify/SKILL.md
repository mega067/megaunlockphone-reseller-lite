---
name: graphify
description: >
  Codebase knowledge graph and architecture intelligence. Use when navigating,
  mapping, querying relationships, tracing dependencies, exploring unknown codebases,
  or analyzing impact of code changes using AST-based knowledge graphs.
---

# Graphify Agent Skill

Graphify turns codebases, schemas, configurations, and documentation into a deterministic, queryable knowledge graph.

## Philosophy & Core Rules
1. **Token Conservation:** Do not blindly scan or read recursive raw files when a knowledge graph exists.
2. **Context Navigation:** Check `graphify-out/` or community clusters to understand call graphs, module boundaries, and entry points.
3. **Structured Mapping:**
   - Extract definitions: functions, classes, models, routes, database tables.
   - Map dependencies: imports, API clients, controllers, event emitters, database queries.
   - Track cross-file impact: identify every caller before refactoring.

## Workflows
- **Codebase Exploration:** Map the project hierarchy and dependencies before proposing changes.
- **Impact Analysis:** For any proposed bugfix or refactoring, determine all upstream callers and downstream side-effects.
- **Architecture Verification:** Ensure boundaries between controllers, models, helpers, and routes are maintained without tight circular coupling.
