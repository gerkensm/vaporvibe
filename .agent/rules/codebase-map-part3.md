---
trigger: glob
globs: **/package.json, **/src/**, **/frontend/src/**
---

#### `components/ABWorkspaceShell.tsx`

**Internal Imports:**

- From `../api/admin`: `discardAbFork`, `fetchAdminState`, `keepAbForkVersion`
- From `./Notifications`: `useNotifications`
- From `../api/types`: `AdminActiveForkSummary`
- From `./ConfirmationModal`: `default as ConfirmationModal`

**External Imports:**

- From `react`: `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`, `MouseEvent as ReactMouseEvent`

#### `components/AttachmentUploader.tsx`

**External Imports:**

- From `react`: `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`, `type ChangeEvent`, `type ClipboardEvent`, `type DragEvent`, `type KeyboardEvent`, `type MutableRefObject`, `type ReactNode`

#### `components/ConfirmationModal.tsx`

**External Imports:**

- From `react`: `type ReactNode`, `useEffect`
- From `react-dom`: `createPortal`

#### `components/HistoryExplorer.tsx`

**Internal Imports:**

- From `../api/types`: `AdminHistoryItem`

**External Imports:**

- From `react`: `useCallback`, `useEffect`, `useMemo`, `useState`, `MouseEvent`, `ReactNode`
- From `react-markdown`: `default as ReactMarkdown`
- From `remark-gfm`: `default as remarkGfm`

#### `components/HistorySnapshotControls.tsx`

**Internal Imports:**

- From `../api/types`: `AdminStateResponse`
- From `./SnapshotImportForm`: `default as SnapshotImportForm`

**External Imports:**

- From `react`: `useCallback`, `useEffect`, `useMemo`, `useState`, `DragEvent`, `MouseEvent`

#### `components/index.ts`

_No imports_

#### `components/ModelInspector.tsx`

**Internal Imports:**

- From `../api/types`: `ModelCompositeScores`, `ModelMetadata`, `ModelReasoningTokens`, `ProviderTokenGuidanceEntry`

**External Imports:**

- From `react`: `forwardRef`, `ChangeEvent`, `ForwardedRef`

#### `components/ModelSelector.tsx`

**Internal Imports:**

- From `../api/types`: `ModelMetadata`, `ProviderTokenGuidanceEntry`

**External Imports:**

- From `react`: `useEffect`, `useMemo`, `useRef`, `useState`

#### `components/Notifications.tsx`

**External Imports:**

- From `react`: `createContext`, `useCallback`, `useContext`, `useEffect`, `useMemo`, `useRef`, `useState`, `type ReactNode`

#### `components/ResumeSessionCallout.tsx`

**Internal Imports:**

- From `../api/types`: `AdminStateResponse`
- From `./SnapshotImportForm`: `default as SnapshotImportForm`

**External Imports:**

- From `react`: `useCallback`, `useState`, `DragEvent`

#### `components/SnapshotImportForm.tsx`

**Internal Imports:**

- From `../api/admin`: `submitHistoryImport`
- From `./AttachmentUploader`: `AttachmentUploader`
- From `./Notifications`: `useNotifications`
- From `../api/types`: `AdminStateResponse`

**External Imports:**

- From `react`: `useCallback`, `useEffect`, `useState`

#### `components/TokenBudgetControl.tsx`

**External Imports:**

- From `react`: `useEffect`, `useMemo`, `useState`

#### `constants/runtime.ts`

_No imports_

#### `instructions-panel.ts`

_No imports_

#### `interceptor-branch-utils.ts`

_No imports_

#### `interceptor.ts`

**Internal Imports:**

- From `./interceptor-branch-utils`: `BRANCH_FIELD`, `resolveActiveBranchId`, `applyBranchToUrl`, `ensureBranchField`

#### `main.tsx`

**Internal Imports:**

- From `./App`: `default as App`

**External Imports:**

- From `react`: `default as React`
- From `react-dom/client`: `default as ReactDOM`

#### `pages/AbTestWorkspacePage.tsx`

**Internal Imports:**

- From `../components/ABWorkspaceShell`: `default as ABWorkspaceShell`

**External Imports:**

- From `react-router-dom`: `Navigate`, `useParams`, `useSearchParams`

#### `pages/AdminDashboard.tsx`

**Internal Imports:**

- From `../components`: `AttachmentUploader`, `ModelSelector`, `TokenBudgetControl`, `CustomModelConfig`
- From `../api/admin`: `fetchAdminState`, `fetchAdminHistory`, `deleteHistoryEntry`, `deleteAllHistoryEntries`, `submitBriefUpdate`, `submitProviderUpdate`, `submitRuntimeUpdate`, `verifyProviderKey`, `type ProviderUpdatePayload`
- From `../constants/runtime`: `HISTORY_LIMIT_MIN`, `HISTORY_LIMIT_MAX`, `HISTORY_MAX_BYTES_MIN`, `HISTORY_MAX_BYTES_MAX`, `DEFAULT_HISTORY_MAX_BYTES`
- From `../components/Notifications`: `useNotifications`
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

