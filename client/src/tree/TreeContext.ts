import { createContext, useContext } from "react";
import type { Tree } from "../types";

export const TreeContext = createContext<Tree | null>(null);

export function useTreeContext(): Tree {
  const t = useContext(TreeContext);
  if (!t) throw new Error("useTreeContext must be used inside a TreeAccessBoundary");
  return t;
}
