import { type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchTree, queryKeys } from "../api/queries";
import { TreeContext } from "./TreeContext";

export function TreeAccessBoundary({ children }: { children: ReactNode }) {
  const { treeId } = useParams();
  const { data: tree, isPending, error } = useQuery({
    queryKey: queryKeys.tree(treeId ?? ""),
    queryFn: () => fetchTree(treeId!),
    enabled: !!treeId,
    retry: false,
  });

  if (!treeId) {
    return (
      <div className="p-10">
        <p>Tree not found or you don't have access.</p>
        <p><Link to="/" className="text-primary hover:underline">← Back to all trees</Link></p>
      </div>
    );
  }

  if (isPending) return <div className="p-10">Loading…</div>;

  if (error) {
    // The server returns 404 for both "missing" and "no access".
    const msg = String((error as Error).message ?? error);
    const notFound =
      msg.toLowerCase().includes("tree not found") || msg.includes("HTTP 404");
    if (notFound) {
      return (
        <div className="p-10">
          <p>Tree not found or you don't have access.</p>
          <p><Link to="/" className="text-primary hover:underline">← Back to all trees</Link></p>
        </div>
      );
    }
    return <div className="p-10 text-destructive">Error: {msg}</div>;
  }

  return <TreeContext.Provider value={tree}>{children}</TreeContext.Provider>;
}
