import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Tree } from "../types";
import { TreeContext } from "./TreeContext";

export function TreeAccessBoundary({ children }: { children: ReactNode }) {
  const { treeId } = useParams();
  const [tree, setTree] = useState<Tree | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!treeId) {
      setStatus("notfound");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    api<Tree>(`/trees/${treeId}`)
      .then((t) => {
        if (cancelled) return;
        setTree(t);
        setStatus("ok");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        const msg = String(e.message ?? e);
        // The server returns 404 for both "missing" and "no access".
        if (msg.toLowerCase().includes("tree not found") || msg.includes("HTTP 404")) {
          setStatus("notfound");
        } else {
          setErrorMsg(msg);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [treeId]);

  if (status === "loading") return <div style={{ padding: 40 }}>Loading…</div>;
  if (status === "notfound") {
    return (
      <div style={{ padding: 40 }}>
        <p>Tree not found or you don't have access.</p>
        <p><Link to="/">← Back to all trees</Link></p>
      </div>
    );
  }
  if (status === "error") {
    return <div style={{ padding: 40, color: "var(--coral)" }}>Error: {errorMsg}</div>;
  }
  return <TreeContext.Provider value={tree!}>{children}</TreeContext.Provider>;
}
