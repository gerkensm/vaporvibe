---
trigger: glob
globs: **/package.json, **/src/**, **/frontend/src/**
---

- From `../constants/runtime`: `HISTORY_LIMIT_MIN`, `HISTORY_LIMIT_MAX`, `HISTORY_MAX_BYTES_MIN`, `HISTORY_MAX_BYTES_MAX`, `DEFAULT_HISTORY_MAX_BYTES`
- From `../components/Notifications`: `useNotifications`
- From `./admin-dashboard/types`: `type AdminDashboardProps`, `type AdminLocationState`, `type AsyncStatus`, `type NullableStatus`, `type ProviderKey`, `type QueuedAttachment`, `type TabKey`
- From `./admin-dashboard/constants`: `HISTORY_PAGE_SIZE`, `HISTORY_REFRESH_INTERVAL_MS`, `HISTORY_TIME_FORMATTER`, `PROVIDER_SORT_ORDER`, `TAB_LABELS`, `TAB_ORDER`, `SETUP_INTRO_STORAGE_KEY`, `DEFAULT_CUSTOM_MODEL_CONFIG`
- From `./admin-dashboard/utils`: `clamp`, `createDefaultCustomConfig`, `createTabPath`, `getTabFromPath`, `isAdminPath`, `normalizeAdminPath`
- From `../api/types`: `AdminBriefAttachment`, `AdminHistoryItem`, `AdminStateResponse`
- From `../components/HistoryExplorer`: `default as HistoryExplorer`
- From `../components/HistorySnapshotControls`: `default as HistorySnapshotControls`
- From `../components/ResumeSessionCallout`: `default as ResumeSessionCallout`
- From `../assets/vaporvibe-icon-both.svg`: `default as vaporvibeLogoUrl`

**External Imports:**

- From `react`: `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`, `ReactNode`
- From `react-router-dom`: `useLocation`, `useNavigate`

#### `pages/SetupWizard.tsx`

**Internal Imports:**

- From `./AdminDashboard`: `default as AdminDashboard`

#### `vite-env.d.ts`

_No imports_


---

## Regenerating This Documentation

To update this file when imports change:

```bash
npm run gen:codebase-map
```

This will re-analyze both backend and frontend source files and regenerate both this markdown documentation and the machine-readable JSON file (`docs/codebase-graph.json`).

