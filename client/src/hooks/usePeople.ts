import { useQuery } from "@tanstack/react-query";
import { fetchPeople, queryKeys } from "../api/queries";

export function usePeople(treeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.treePeople(treeId ?? ""),
    queryFn: () => fetchPeople(treeId!),
    enabled: !!treeId,
  });
}
