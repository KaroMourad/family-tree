import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTreeContext } from "../tree/TreeContext";
import type { Person } from "../types";
import { usePeople } from "../hooks/usePeople";
import {
  useCreatePerson,
  useUpdatePerson,
  useDeletePerson,
  useDeleteTree,
  useRenameTree,
  useImportTree,
} from "../hooks/useTreeMutations";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Search,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useUIStore } from "../store/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import "../styles/views.css";

function genderClass(g?: string | null) {
  if (!g) return "";
  const s = g.toLowerCase();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f") || s.startsWith("w")) return "female";
  return "";
}

function countNodes(nodes: Array<{ children?: unknown[] }>): number {
  return nodes.reduce(
    (sum, n) =>
      sum +
      1 +
      (Array.isArray(n.children)
        ? countNodes(n.children as Array<{ children?: unknown[] }>)
        : 0),
    0,
  );
}

type FormState = Partial<Person> & { name: string };

function emptyForm(parentId: string | null = null): FormState {
  return {
    name: "",
    gender: "",
    nickname: null,
    surnameNow: null,
    surnameBirth: null,
    deceased: null,
    birthYear: null,
    birthMonth: null,
    birthDay: null,
    deathYear: null,
    birthPlace: null,
    deathPlace: null,
    partnerName: null,
    profession: null,
    bio: null,
    parentId,
  };
}

function PersonForm({
  initial,
  title,
  open,
  onCancel,
  onSave,
}: {
  initial: FormState;
  title: string;
  open: boolean;
  onCancel: () => void;
  onSave: (data: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMoreInitial = !!(
    initial.nickname ||
    initial.surnameBirth ||
    initial.surnameNow ||
    initial.birthYear ||
    initial.deathYear ||
    initial.partnerName ||
    initial.profession ||
    initial.bio
  );
  const [moreOpen, setMoreOpen] = useState(hasMoreInitial);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.name.trim()) return setError("Name is required");
    setBusy(true);
    setError(null);
    try {
      await onSave(form);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel();
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="uppercase tracking-widest text-primary">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">
              Name *
            </Label>
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">
              Gender
            </Label>
            <Select
              value={form.gender ?? "_unset"}
              onValueChange={(v) => update("gender", v === "_unset" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_unset">—</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs uppercase tracking-widest text-secondary hover:bg-muted/60 transition-colors">
              <span>More details</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label className="uppercase tracking-widest text-xs text-secondary">
                  Nickname
                </Label>
                <Input
                  value={form.nickname ?? ""}
                  onChange={(e) => update("nickname", e.target.value || null)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="uppercase tracking-widest text-xs text-secondary">
                    Surname (birth)
                  </Label>
                  <Input
                    value={form.surnameBirth ?? ""}
                    onChange={(e) =>
                      update("surnameBirth", e.target.value || null)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="uppercase tracking-widest text-xs text-secondary">
                    Surname (now)
                  </Label>
                  <Input
                    value={form.surnameNow ?? ""}
                    onChange={(e) =>
                      update("surnameNow", e.target.value || null)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="uppercase tracking-widest text-xs text-secondary">
                    Birth year
                  </Label>
                  <Input
                    type="number"
                    value={form.birthYear ?? ""}
                    onChange={(e) =>
                      update(
                        "birthYear",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="uppercase tracking-widest text-xs text-secondary">
                    Death year
                  </Label>
                  <Input
                    type="number"
                    value={form.deathYear ?? ""}
                    onChange={(e) =>
                      update(
                        "deathYear",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="uppercase tracking-widest text-xs text-secondary">
                  Partner name
                </Label>
                <Input
                  value={form.partnerName ?? ""}
                  onChange={(e) =>
                    update("partnerName", e.target.value || null)
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="uppercase tracking-widest text-xs text-secondary">
                  Profession
                </Label>
                <Input
                  value={form.profession ?? ""}
                  onChange={(e) => update("profession", e.target.value || null)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="uppercase tracking-widest text-xs text-secondary">
                  Notes / Bio
                </Label>
                <Textarea
                  value={form.bio ?? ""}
                  onChange={(e) => update("bio", e.target.value || null)}
                  className="min-h-[60px]"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EditorState = {
  mode: "create" | "edit";
  person: FormState;
  id?: string;
} | null;

export function Editor() {
  const { treeId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const contextTree = useTreeContext();
  const [treeName, setTreeName] = useState(contextTree.name);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(contextTree.name);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const { data: people = [], isPending: loading, error } = usePeople(treeId);
  const createPersonMutation = useCreatePerson(treeId!);
  const updatePersonMutation = useUpdatePerson(treeId!);
  const deletePersonMutation = useDeletePerson(treeId!);
  const renameTreeMutation = useRenameTree(treeId!);
  const deleteTreeMutation = useDeleteTree();
  const q = useUIStore((s) => s.searchQuery);
  const setQ = useUIStore((s) => s.setSearchQuery);
  const importTreeMutation = useImportTree(treeId!);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{
    doc: unknown;
    count: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleExport() {
    try {
      const doc = await (await import("../api/queries")).exportTree(treeId!);
      const blob = new Blob([JSON.stringify(doc, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${treeName.replace(/[^\w.-]+/g, "_") || "tree"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(`Couldn't export: ${(e as Error).message}`);
    }
  }

  function onImportFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let doc: { formatVersion?: unknown; people?: unknown[] };
      try {
        doc = JSON.parse(String(reader.result));
      } catch {
        setImportError("That file isn't valid JSON.");
        toast.error("That file isn't valid JSON.");
        return;
      }
      // Validate the document shape before offering a destructive replace, so
      // the confirm count is meaningful and matches what the server accepts.
      if (doc?.formatVersion !== 1 || !Array.isArray(doc.people)) {
        setImportError(
          "That file isn't a family-tree export (expected formatVersion 1 with a people array).",
        );
        toast.error("That file isn't a family-tree export.");
        return;
      }
      const count = countNodes(doc.people as Array<{ children?: unknown[] }>);
      setPendingImport({ doc, count });
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!pendingImport) return;
    try {
      await importTreeMutation.mutateAsync(pendingImport.doc);
      setPendingImport(null);
    } catch {
      // toast handled in hook; keep dialog open so the user can retry/cancel
    }
  }
  const [editorState, setEditorState] = useState<EditorState>(null);
  // Open-state model: same semantics as ListView. openIds holds nodes whose
  // visible state has been explicitly toggled away from `defaultOpen`.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [defaultOpen, setDefaultOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteTreeOpen, setDeleteTreeOpen] = useState(false);
  const [deleteTreeName, setDeleteTreeName] = useState("");
  const [deleteTreeBusy, setDeleteTreeBusy] = useState(false);
  const [deleteTreeError, setDeleteTreeError] = useState<string | null>(null);

  async function deleteThisTree() {
    if (deleteTreeName !== treeName) {
      setDeleteTreeError("Type the tree name exactly to confirm.");
      return;
    }
    setDeleteTreeBusy(true);
    setDeleteTreeError(null);
    try {
      await deleteTreeMutation.mutateAsync(treeId!);
      navigate("/");
    } catch (e) {
      setDeleteTreeError(String((e as Error).message));
      setDeleteTreeBusy(false);
    }
  }

  async function saveTreeName() {
    const next = renameDraft.trim();
    if (!next) {
      setRenameError("Name cannot be empty");
      return;
    }
    if (next === treeName) {
      setRenaming(false);
      return;
    }
    setRenameBusy(true);
    setRenameError(null);
    try {
      const updated = await renameTreeMutation.mutateAsync(next);
      setTreeName(updated.name);
      setRenaming(false);
    } catch (e) {
      setRenameError(String((e as Error).message));
    } finally {
      setRenameBusy(false);
    }
  }

  function cancelRename() {
    setRenameDraft(treeName);
    setRenameError(null);
    setRenaming(false);
  }

  const { roots, byParent, parentOf } = useMemo(() => {
    const byParent = new Map<string | null, Person[]>();
    const parentOf = new Map<string, string | null>();
    for (const p of people) {
      const list = byParent.get(p.parentId) ?? [];
      list.push(p);
      byParent.set(p.parentId, list);
      parentOf.set(p.id, p.parentId);
    }
    return { roots: byParent.get(null) ?? [], byParent, parentOf };
  }, [people]);

  // Substring match across name, nickname, id, and surnames — same rule as ListView.
  const matches = useMemo(() => {
    const set = new Set<string>();
    const term = q.trim().toLowerCase();
    if (!term) return set;
    for (const p of people) {
      const hay = `${p.name} ${p.nickname ?? ""} ${p.id} ${p.surnameNow ?? ""} ${p.surnameBirth ?? ""}`.toLowerCase();
      if (hay.includes(term)) set.add(p.id);
    }
    return set;
  }, [q, people]);

  // While a query is active, force every ancestor of every match open so the
  // matching nodes are visible (they may otherwise be inside collapsed branches).
  const ancestorsOfMatches = useMemo(() => {
    const set = new Set<string>();
    if (matches.size === 0) return set;
    for (const id of matches) {
      let p = parentOf.get(id) ?? null;
      while (p && !set.has(p)) {
        set.add(p);
        p = parentOf.get(p) ?? null;
      }
    }
    return set;
  }, [matches, parentOf]);

  // Match ids in DOM order (pre-order traversal), so up/down navigation
  // visits matches top-to-bottom as they appear in the tree.
  const matchedIds = useMemo(() => {
    const out: string[] = [];
    if (matches.size === 0) return out;
    const walk = (list: Person[]) => {
      for (const p of list) {
        if (matches.has(p.id)) out.push(p.id);
        const kids = byParent.get(p.id);
        if (kids) walk(kids);
      }
    };
    walk(roots);
    return out;
  }, [matches, byParent, roots]);

  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  // Whenever the set of matches changes, reset to the first match.
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [matchedIds]);
  // Scroll the currently-focused match into view.
  useEffect(() => {
    if (matchedIds.length === 0) return;
    const id = matchedIds[currentMatchIndex];
    if (!id) return;
    const el = document.getElementById(`node-${id}`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [matchedIds, currentMatchIndex]);

  const currentMatchId = matchedIds[currentMatchIndex] ?? null;
  const goPrevMatch = () => {
    if (matchedIds.length === 0) return;
    setCurrentMatchIndex((i) => (i - 1 + matchedIds.length) % matchedIds.length);
  };
  const goNextMatch = () => {
    if (matchedIds.length === 0) return;
    setCurrentMatchIndex((i) => (i + 1) % matchedIds.length);
  };

  async function handleSave(data: FormState) {
    const { id: _omit, ...rest } = data as Record<string, unknown> as any;
    if (editorState?.mode === "edit") {
      await updatePersonMutation.mutateAsync({
        id: editorState.id!,
        patch: rest,
      });
    } else {
      await createPersonMutation.mutateAsync(rest);
    }
    setEditorState(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deletePersonMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(String((e as Error).message));
    } finally {
      setDeleteBusy(false);
    }
  }

  function toggleNode(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function expandAll() {
    setDefaultOpen(true);
    setOpenIds(new Set());
  }
  function collapseAll() {
    setDefaultOpen(false);
    setOpenIds(new Set());
  }
  const isNodeOpen = (id: string) => {
    // While searching, ancestors of matches are forced open so matches are
    // visible. Clearing the query restores the user's previous toggle state
    // verbatim because we don't mutate openIds/defaultOpen here.
    if (ancestorsOfMatches.has(id)) return true;
    return openIds.has(id) ? !defaultOpen : defaultOpen;
  };

  function countDescendants(id: string): number {
    const kids = byParent.get(id) ?? [];
    return kids.reduce((sum, c) => sum + 1 + countDescendants(c.id), 0);
  }

  function renderNode(p: Person, depth: number): JSX.Element {
    const kids = byParent.get(p.id) ?? [];
    const isOpen = isNodeOpen(p.id);
    const cls = ["card", genderClass(p.gender)];
    return (
      <li
        key={p.id}
        id={`node-${p.id}`}
        className={`node${!isOpen && kids.length > 0 ? " collapsed" : ""}${matches.has(p.id) ? " match" : ""}${currentMatchId === p.id ? " current-match" : ""}`}
      >
        <span className={cls.join(" ")}>
          <span
            className={`toggle${kids.length === 0 ? " empty" : ""}`}
            onClick={() => kids.length > 0 && toggleNode(p.id)}
          >
            {kids.length === 0 ? "·" : isOpen ? "−" : "+"}
          </span>
          <span className="name">{p.name}</span>
          {(p.birthYear || p.deathYear) && (
            <span className="meta">
              ({p.birthYear ?? ""}
              {p.birthYear || p.deathYear ? " – " : ""}
              {p.deathYear ?? ""})
            </span>
          )}
          {kids.length > 0 && (
            <span className="children-count">{countDescendants(p.id)}</span>
          )}
          <span className="inline-flex items-center gap-1 ml-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-primary uppercase tracking-widest hover:bg-primary/15"
              onClick={() =>
                setEditorState({ mode: "create", person: emptyForm(p.id) })
              }
              title="Add child"
            >
              + Child
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] uppercase tracking-widest"
              onClick={() =>
                setEditorState({
                  mode: "edit",
                  person: { ...(p as any), name: p.name },
                  id: p.id,
                })
              }
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-destructive uppercase tracking-widest hover:bg-destructive/15"
              onClick={() => {
                setDeleteTarget(p);
                setDeleteError(null);
              }}
            >
              Delete
            </Button>
          </span>
        </span>
        {kids.length > 0 && isOpen && (
          <ul>{kids.map((c) => renderNode(c, depth + 1))}</ul>
        )}
      </li>
    );
  }

  if (loading) return <div className="p-10">Loading…</div>;
  if (error)
    return <div className="p-10 text-destructive">Error: {error.message}</div>;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="shrink-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        {/* Row 1 — app/nav header */}
        <header className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="uppercase tracking-widest"
          >
            <Link to={`/tree/${treeId}`}>← Views</Link>
          </Button>
          <span className="ml-auto text-xs text-muted-foreground tracking-widest truncate">
            {people.length} people
            <span className="hidden sm:inline">
              {" "}· {user?.email} ({user?.role})
            </span>
          </span>
          <Button size="sm" variant="outline" onClick={logout}>
            Logout
          </Button>
          <ThemeToggle />
        </header>
        {/* Row 2 — tree sub-header (scoped to this tree) */}
        <div className="flex items-center gap-3 px-4 sm:px-6 h-12 border-t border-border/60">
          {renaming ? (
            <span className="inline-flex items-center gap-2">
              <Input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTreeName();
                  else if (e.key === "Escape") cancelRename();
                }}
                disabled={renameBusy}
                className="text-lg w-64"
              />
              <Button size="sm" onClick={saveTreeName} disabled={renameBusy}>
                {renameBusy ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelRename}
                disabled={renameBusy}
              >
                Cancel
              </Button>
              {renameError && (
                <span className="text-destructive text-xs">{renameError}</span>
              )}
            </span>
          ) : (
            <h1
              onClick={() => {
                setRenameDraft(treeName);
                setRenameError(null);
                setRenaming(true);
              }}
              className="m-0 text-lg font-semibold text-primary uppercase tracking-[0.15em] cursor-pointer truncate min-w-0"
              title="Click to rename"
            >
              ◆ {treeName} ✎
            </h1>
          )}
          {/* Search: by name, nickname, id, or surname */}
          <div className="ml-auto relative flex-1 max-w-sm min-w-0">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name or ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) goPrevMatch();
                  else goNextMatch();
                } else if (e.key === "Escape" && q) {
                  e.preventDefault();
                  setQ("");
                }
              }}
              className={`pl-8 h-8 ${q ? "pr-28" : "pr-3"}`}
            />
            {q && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <span className="px-1 text-[10px] tabular-nums text-muted-foreground tracking-widest">
                  {matchedIds.length === 0
                    ? "no match"
                    : `${currentMatchIndex + 1} / ${matchedIds.length}`}
                </span>
                <button
                  type="button"
                  aria-label="Previous match"
                  onClick={goPrevMatch}
                  disabled={matchedIds.length === 0}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Next match"
                  onClick={goNextMatch}
                  disabled={matchedIds.length === 0}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQ("")}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          {/* Single ⋯ actions menu (same on desktop and mobile) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More actions"
              className={buttonVariants({
                variant: "outline",
                size: "icon-sm",
              })}
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setEditorState({ mode: "create", person: emptyForm(null) });
                }}
              >
                <UserPlus /> Add root person
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  expandAll();
                }}
              >
                <Maximize2 /> Expand all
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  collapseAll();
                }}
              >
                <Minimize2 /> Collapse all
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleExport();
                }}
              >
                <Download /> Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }}
              >
                <Upload /> Import JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteTreeOpen(true);
                  setDeleteTreeName("");
                  setDeleteTreeError(null);
                }}
              >
                <Trash2 /> Delete tree
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFileChosen}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 p-6 overflow-auto">
        <ul className="tree-list">{roots.map((r) => renderNode(r, 0))}</ul>
      </div>

      <PersonForm
        key={
          editorState
            ? `${editorState.mode}-${editorState.id ?? "new"}`
            : "closed"
        }
        open={!!editorState}
        initial={editorState?.person ?? emptyForm(null)}
        title={
          editorState?.mode === "create"
            ? "Add person"
            : `Edit ${editorState?.person.name ?? ""}`
        }
        onCancel={() => setEditorState(null)}
        onSave={handleSave}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o && !deleteBusy) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-widest text-destructive">
              Delete {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget &&
                (() => {
                  const kids = byParent.get(deleteTarget.id) ?? [];
                  return kids.length > 0
                    ? `Their ${kids.length} direct child${kids.length === 1 ? "" : "ren"} will become roots. This cannot be undone.`
                    : "This cannot be undone.";
                })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteBusy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={deleteTreeOpen}
        onOpenChange={(o) => {
          if (!o && !deleteTreeBusy) {
            setDeleteTreeOpen(false);
            setDeleteTreeError(null);
            setDeleteTreeName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-destructive">
              Delete "{treeName}"?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              This deletes the tree and all {people.length} people in it. There
              is no undo.
            </p>
            <p>Type the tree name to confirm:</p>
            <Input
              value={deleteTreeName}
              onChange={(e) => setDeleteTreeName(e.target.value)}
              placeholder={treeName}
            />
            {deleteTreeError && (
              <Alert variant="destructive">
                <AlertDescription>{deleteTreeError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTreeOpen(false)}
              disabled={deleteTreeBusy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteThisTree}
              disabled={deleteTreeBusy}
            >
              {deleteTreeBusy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingImport}
        onOpenChange={(o) => {
          if (!o && !importTreeMutation.isPending) {
            setPendingImport(null);
            setImportError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-widest text-destructive">
              Replace this tree?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all {people.length} people in "{treeName}" with{" "}
              {pendingImport?.count ?? 0} people from the file. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {importError && (
            <Alert variant="destructive">
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importTreeMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmImport();
              }}
              disabled={importTreeMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {importTreeMutation.isPending ? "Importing…" : "Replace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
