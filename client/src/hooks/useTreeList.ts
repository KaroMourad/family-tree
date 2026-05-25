import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { TreeSummary } from "../types";

export function useTreeList() {
  const [trees, setTrees] = useState<TreeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrees(await api<TreeSummary[]>("/trees"));
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { trees, error, loading, refresh };
}
