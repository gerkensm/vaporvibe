---
trigger: always_on
globs: **/*
---

## Regenerating This Documentation

To update this file when imports change:

```bash
npm run gen:codebase-map
```

This will re-analyze both backend and frontend source files and regenerate both this markdown documentation and the machine-readable JSON file (`docs/codebase-graph.json`).

