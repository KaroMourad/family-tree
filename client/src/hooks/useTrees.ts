import { useQuery } from "@tanstack/react-query";
import { fetchTrees, queryKeys } from "../api/queries";

export function useTrees() {
  return useQuery({
    queryKey: queryKeys.trees(),
    queryFn: fetchTrees,
  });
}
