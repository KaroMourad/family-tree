import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// A child anywhere in the tree can portal nodes into a named slot owned by a
// parent (TreeLayout). The Provider holds current content per slot; a
// <TreeSubHeaderSlot name="..."> child sets that content for its lifetime and
// clears it on unmount.
//
// Slots in use:
//   "title"   — overrides the default read-only tree title (editor uses this for rename UI).
//   "actions" — view-specific controls rendered to the right of the search input.

type SlotName = "title" | "actions";
type SetContent = (slot: SlotName, node: ReactNode) => void;

const Ctx = createContext<SetContent | null>(null);

export function TreeSubHeaderSlotProvider({
  children,
  onContentChange,
}: {
  children: ReactNode;
  onContentChange: SetContent;
}) {
  return <Ctx.Provider value={onContentChange}>{children}</Ctx.Provider>;
}

export function TreeSubHeaderSlot({
  name,
  children,
}: {
  name: SlotName;
  children: ReactNode;
}) {
  const setContent = useContext(Ctx);
  useEffect(() => {
    if (!setContent) return;
    setContent(name, children);
    return () => setContent(name, null);
  }, [setContent, name, children]);
  return null;
}

/** Hook used by TreeLayout to hold whatever the active page registered. */
export function useTreeSubHeaderSlots() {
  const [slots, setSlots] = useState<Record<SlotName, ReactNode>>({
    title: null,
    actions: null,
  });
  const setSlot = useCallback<SetContent>(
    (name, node) => setSlots((prev) => ({ ...prev, [name]: node })),
    [],
  );
  return [slots, setSlot] as const;
}
