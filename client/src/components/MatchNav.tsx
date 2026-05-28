import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// A view tells the layout: "here are the matching person ids in display
// order, and here's how to focus one of them." The layout owns the
// 'current match index' and exposes prev/next + a counter for its
// search-input controls.

export type MatchNavRegistration = {
  /** Matching person ids in display order (top-to-bottom / pre-order). */
  matchedIds: string[];
  /**
   * Bring the given id into view. DOM views scroll into view; SVG views
   * pan/zoom to the node. A no-op is acceptable (arrows still work; they
   * just won't auto-focus).
   */
  focusMatch?: (id: string) => void;
};

type MatchNavState = {
  registration: MatchNavRegistration | null;
  setRegistration: (r: MatchNavRegistration | null) => void;
  currentIndex: number;
  setCurrentIndex: (i: number | ((prev: number) => number)) => void;
};

const Ctx = createContext<MatchNavState | null>(null);

export function MatchNavProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<MatchNavRegistration | null>(
    null,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const matchedIds = registration?.matchedIds ?? EMPTY;
  const focusMatch = registration?.focusMatch;

  // Reset to the first match whenever the matched-id list changes.
  useEffect(() => {
    setCurrentIndex(0);
  }, [matchedIds]);
  // Auto-focus the current match when the list or index changes.
  useEffect(() => {
    if (matchedIds.length === 0 || !focusMatch) return;
    const id = matchedIds[currentIndex];
    if (id) focusMatch(id);
  }, [matchedIds, currentIndex, focusMatch]);

  const value = useMemo(
    () => ({ registration, setRegistration, currentIndex, setCurrentIndex }),
    [registration, currentIndex],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Views call this to expose their match list (and optional focus handler)
 * to the layout's match-nav controls. Pass `null`-ish data freely; the
 * registration is replaced each render but stable references avoid
 * thrashing if you memoize.
 */
export function useRegisterMatchNav(registration: MatchNavRegistration) {
  const ctx = useContext(Ctx);
  useEffect(() => {
    if (!ctx) return;
    ctx.setRegistration(registration);
    return () => ctx.setRegistration(null);
    // Re-register only when the matched list or focus handler identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration.matchedIds, registration.focusMatch]);
}

/**
 * Read the current match-nav state. Safe to call from anywhere inside
 * MatchNavProvider: the index and the registration are shared, so both
 * the layout (counter + prev/next) and views (current-match highlighting)
 * see the same values.
 *
 * When no view has registered, total is 0 and the handlers are no-ops.
 */
export function useMatchNav() {
  const ctx = useContext(Ctx);
  const matchedIds = ctx?.registration?.matchedIds ?? EMPTY;
  const currentIndex = ctx?.currentIndex ?? 0;
  const setCurrentIndex = ctx?.setCurrentIndex;

  const goPrev = useCallback(() => {
    if (!setCurrentIndex || matchedIds.length === 0) return;
    setCurrentIndex((i) => (i - 1 + matchedIds.length) % matchedIds.length);
  }, [matchedIds.length, setCurrentIndex]);

  const goNext = useCallback(() => {
    if (!setCurrentIndex || matchedIds.length === 0) return;
    setCurrentIndex((i) => (i + 1) % matchedIds.length);
  }, [matchedIds.length, setCurrentIndex]);

  return {
    total: matchedIds.length,
    currentIndex,
    currentId: matchedIds[currentIndex] ?? null,
    goPrev,
    goNext,
  };
}

const EMPTY: string[] = [];
