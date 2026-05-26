import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useTreeContext } from "../tree/TreeContext";
import type { Person, Tree } from "../types";
import { Button } from "@/components/ui/button";
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
import { ChevronDown } from "lucide-react";
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
import "../styles/views.css";

function genderClass(g?: string | null) {
  if (!g) return "";
  const s = g.toLowerCase();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f") || s.startsWith("w")) return "female";
  return "";
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
  const hasMoreInitial =
    !!(initial.nickname || initial.surnameBirth || initial.surnameNow ||
       initial.birthYear || initial.deathYear ||
       initial.partnerName || initial.profession || initial.bio);
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
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="uppercase tracking-widest text-primary">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">Name *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">Gender</Label>
            <Select value={form.gender ?? "_unset"} onValueChange={(v) => update("gender", v === "_unset" ? null : v)}>
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
              <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label className="uppercase tracking-widest text-xs text-secondary">Nickname</Label>
                <Input value={form.nickname ?? ""} onChange={(e) => update("nickname", e.target.value || null)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="uppercase tracking-widest text-xs text-secondary">Surname (birth)</Label>
                  <Input value={form.surnameBirth ?? ""} onChange={(e) => update("surnameBirth", e.target.value || null)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="uppercase tracking-widest text-xs text-secondary">Surname (now)</Label>
                  <Input value={form.surnameNow ?? ""} onChange={(e) => update("surnameNow", e.target.value || null)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="uppercase tracking-widest text-xs text-secondary">Birth year</Label>
                  <Input
                    type="number"
                    value={form.birthYear ?? ""}
                    onChange={(e) => update("birthYear", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="uppercase tracking-widest text-xs text-secondary">Death year</Label>
                  <Input
                    type="number"
                    value={form.deathYear ?? ""}
                    onChange={(e) => update("deathYear", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="uppercase tracking-widest text-xs text-secondary">Partner name</Label>
                <Input value={form.partnerName ?? ""} onChange={(e) => update("partnerName", e.target.value || null)} />
              </div>

              <div className="space-y-1.5">
                <Label className="uppercase tracking-widest text-xs text-secondary">Profession</Label>
                <Input value={form.profession ?? ""} onChange={(e) => update("profession", e.target.value || null)} />
              </div>

              <div className="space-y-1.5">
                <Label className="uppercase tracking-widest text-xs text-secondary">Notes / Bio</Label>
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
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EditorState = { mode: "create" | "edit"; person: FormState; id?: string } | null;

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
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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
      await api(`/trees/${treeId}`, { method: "DELETE" });
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
      const updated = await api<Tree>(`/trees/${treeId}`, {
        method: "PUT",
        body: JSON.stringify({ name: next }),
      });
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<Person[]>(`/trees/${treeId}/people`);
      setPeople(list);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, [treeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { roots, byParent } = useMemo(() => {
    const byParent = new Map<string | null, Person[]>();
    for (const p of people) {
      const list = byParent.get(p.parentId) ?? [];
      list.push(p);
      byParent.set(p.parentId, list);
    }
    return { roots: byParent.get(null) ?? [], byParent };
  }, [people]);

  async function handleSave(data: FormState) {
    const { id: _omit, ...rest } = data as Record<string, unknown> as any;
    const payload = rest;
    if (editorState?.mode === "edit") {
      await api<Person>(`/trees/${treeId}/people/${editorState.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api<Person>(`/trees/${treeId}/people`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    setEditorState(null);
    await refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api(`/trees/${treeId}/people/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      setDeleteError(String((e as Error).message));
    } finally {
      setDeleteBusy(false);
    }
  }

  function toggleNode(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(p: Person, depth: number): JSX.Element {
    const kids = byParent.get(p.id) ?? [];
    const isCollapsed = collapsed.has(p.id);
    const cls = ["card", genderClass(p.gender)];
    return (
      <li key={p.id} className={`node${isCollapsed ? " collapsed" : ""}`}>
        <span className={cls.join(" ")}>
          <span
            className={`toggle${kids.length === 0 ? " empty" : ""}`}
            onClick={() => kids.length > 0 && toggleNode(p.id)}
          >
            {kids.length === 0 ? "·" : isCollapsed ? "+" : "−"}
          </span>
          <span className="name">{p.name}</span>
          {(p.birthYear || p.deathYear) && (
            <span className="meta">
              ({p.birthYear ?? ""}{p.birthYear || p.deathYear ? " – " : ""}{p.deathYear ?? ""})
            </span>
          )}
          <span className="id-tag">#{p.id}</span>
          <span className="inline-flex items-center gap-1 ml-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-primary uppercase tracking-widest hover:bg-primary/15"
              onClick={() => setEditorState({ mode: "create", person: emptyForm(p.id) })}
              title="Add child"
            >
              + Child
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] uppercase tracking-widest"
              onClick={() => setEditorState({ mode: "edit", person: { ...(p as any), name: p.name }, id: p.id })}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-destructive uppercase tracking-widest hover:bg-destructive/15"
              onClick={() => { setDeleteTarget(p); setDeleteError(null); }}
            >
              Delete
            </Button>
          </span>
        </span>
        {kids.length > 0 && !isCollapsed && (
          <ul>{kids.map((c) => renderNode(c, depth + 1))}</ul>
        )}
      </li>
    );
  }

  if (loading) return <div className="p-10">Loading…</div>;
  if (error) return <div className="p-10 text-destructive">Error: {error}</div>;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="shrink-0 z-10 flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border bg-background/90 backdrop-blur">
          <Button asChild variant="outline" size="sm" className="uppercase tracking-widest">
            <Link to={`/tree/${treeId}`}>← Views</Link>
          </Button>
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
              <Button size="sm" variant="outline" onClick={cancelRename} disabled={renameBusy}>
                Cancel
              </Button>
              {renameError && <span className="text-destructive text-xs">{renameError}</span>}
            </span>
          ) : (
            <h1
              onClick={() => {
                setRenameDraft(treeName);
                setRenameError(null);
                setRenaming(true);
              }}
              className="m-0 text-lg font-semibold text-primary uppercase tracking-[0.15em] cursor-pointer"
              title="Click to rename"
            >
              ◆ {treeName} ✎
            </h1>
          )}
          <Button size="sm" onClick={() => setEditorState({ mode: "create", person: emptyForm(null) })} className="uppercase tracking-widest">
            + Root person
          </Button>
          <span className="ml-auto text-xs text-muted-foreground tracking-widest">
            {people.length} people · {user?.email} ({user?.role})
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setDeleteTreeOpen(true); setDeleteTreeName(""); setDeleteTreeError(null); }}
            className="uppercase tracking-widest text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            Delete tree
          </Button>
          <Button size="sm" variant="outline" onClick={logout}>Logout</Button>
          <ThemeToggle />
        </header>

        <div className="flex-1 min-h-0 p-6 overflow-auto">
          <ul className="tree-list">{roots.map((r) => renderNode(r, 0))}</ul>
        </div>

      <PersonForm
        key={editorState ? `${editorState.mode}-${editorState.id ?? "new"}` : "closed"}
        open={!!editorState}
        initial={editorState?.person ?? emptyForm(null)}
        title={editorState?.mode === "create" ? "Add person" : `Edit ${editorState?.person.name ?? ""}`}
        onCancel={() => setEditorState(null)}
        onSave={handleSave}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o && !deleteBusy) { setDeleteTarget(null); setDeleteError(null); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-widest text-destructive">
              Delete {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (() => {
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
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
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
              This deletes the tree and all {people.length} people in it. There is no undo.
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
    </div>
  );
}
