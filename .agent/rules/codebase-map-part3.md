---
trigger: glob
globs: **/package.json, **/src/**, **/frontend/src/**
---

  components_ABWorkspaceShell_tsx["ABWorkspaceShell.tsx"]
  ___api_admin["admin"] --> components_ABWorkspaceShell_tsx
  __Notifications["Notifications"] --> components_ABWorkspaceShell_tsx
  ___api_types["types"] --> components_ABWorkspaceShell_tsx
  __ConfirmationModal["ConfirmationModal"] --> components_ABWorkspaceShell_tsx
  components_SnapshotImportForm_tsx["SnapshotImportForm.tsx"]
  ___api_admin["admin"] --> components_SnapshotImportForm_tsx
  __AttachmentUploader["AttachmentUploader"] --> components_SnapshotImportForm_tsx
  __Notifications["Notifications"] --> components_SnapshotImportForm_tsx
  ___api_types["types"] --> components_SnapshotImportForm_tsx
  components_HistoryExplorer_tsx["HistoryExplorer.tsx"]
  ___api_types["types"] --> components_HistoryExplorer_tsx
  components_HistorySnapshotControls_tsx["HistorySnapshotControls.tsx"]
  ___api_types["types"] --> components_HistorySnapshotControls_tsx
  __SnapshotImportForm["SnapshotImportForm"] --> components_HistorySnapshotControls_tsx
  components_ResumeSessionCallout_tsx["ResumeSessionCallout.tsx"]
  ___api_types["types"] --> components_ResumeSessionCallout_tsx
  __SnapshotImportForm["SnapshotImportForm"] --> components_ResumeSessionCallout_tsx
  main_tsx["main.tsx"]
  __App["App"] --> main_tsx
  components_ConfirmationModal_tsx["ConfirmationModal.tsx"]
  components_ImageModelSelector_tsx["ImageModelSelector.tsx"]
  ___api_types["types"] --> components_ImageModelSelector_tsx
```

---

### External Dependencies

#### `react`

Used by 14 module(s)

#### `react-router-dom`

Used by 3 module(s)

#### `react-dom`

Used by 2 module(s)

#### `react-markdown`

Used by 1 module(s)

#### `remark-gfm`

Used by 1 module(s)

---

### Module Import Details

#### `api/admin.ts`

**Internal Imports:**

- From `./types`: `AdminHistoryResponse`, `AdminStateResponse`, `AdminUpdateResponse`

#### `api/types.ts`

_No imports_

#### `App.tsx`

**Internal Imports:**

- From `./components/Notifications`: `NotificationsProvider`
- From `./pages/AdminDashboard`: `default as AdminDashboard`
- From `./pages/AbTestWorkspacePage`: `default as AbTestWorkspacePage`
- From `./pages/SetupWizard`: `default as SetupWizard`

**External Imports:**

- From `react-router-dom`: `BrowserRouter`, `Navigate`, `Route`, `Routes`

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

#### `components/ImageModelSelector.tsx`

**Internal Imports:**

- From `../api/types`: `AdminImageGenerationInfo`

**External Imports:**

- From `react`: `useMemo`

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

- From `../components`: `AttachmentUploader`, `ModelSelector`, `ImageModelSelector`, `TokenBudgetControl`, `CustomModelConfig`
- From `../api/admin`: `fetchAdminState`, `fetchAdminHistory`, `deleteHistoryEntry`, `deleteAllHistoryEntries`, `submitBriefUpdate`, `submitProviderUpdate`, `submitRuntimeUpdate`, `verifyProviderKey`, `type ProviderUpdatePayload`, `type RuntimeUpdatePayload`
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

