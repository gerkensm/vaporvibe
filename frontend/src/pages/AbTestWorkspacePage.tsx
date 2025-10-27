import { Navigate, useParams, useSearchParams } from "react-router-dom";

import ABWorkspaceShell from "../components/ABWorkspaceShell";

export default function AbTestWorkspacePage() {
  const { forkId } = useParams<{ forkId: string }>();
  const [searchParams] = useSearchParams();

  if (!forkId) {
    return <Navigate to="/vaporvibe" replace />;
  }

  const branchA = searchParams.get("branchA") ?? undefined;
  const branchB = searchParams.get("branchB") ?? undefined;
  const source = searchParams.get("source") ?? undefined;

  return (
    <ABWorkspaceShell
      forkId={forkId}
      initialBranchA={branchA}
      initialBranchB={branchB}
      sourcePathParam={source}
    />
  );
}
