import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest text-primary">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">Name *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Nickname</Label>
              <Input value={form.nickname ?? ""} onChange={(e) => update("nickname", e.target.value || null)} />
            </div>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Birth place</Label>
              <Input value={form.birthPlace ?? ""} onChange={(e) => update("birthPlace", e.target.value || null)} />
            </div>
            <div className="space-y-1.5">
              <Label className="uppercase tracking-widest text-xs text-secondary">Death place</Label>
              <Input value={form.deathPlace ?? ""} onChange={(e) => update("deathPlace", e.target.value || null)} />
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
            <Label className="uppercase tracking-widest text-xs text-secondary">Deceased</Label>
            <Select value={form.deceased ?? "_unset"} onValueChange={(v) => update("deceased", v === "_unset" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_unset">—</SelectItem>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="uppercase tracking-widest text-xs text-secondary">Notes / Bio</Label>
            <Textarea
              value={form.bio ?? ""}
              onChange={(e) => update("bio", e.target.value || null)}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
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

  async function handleDelete(p: Person) {
    const kids = byParent.get(p.id) ?? [];
    const msg =
      kids.length > 0
        ? `Delete ${p.name}? Their ${kids.length} direct child${kids.length === 1 ? "" : "ren"} will become roots.`
        : `Delete ${p.name}?`;
    if (!confirm(msg)) return;
    try {
      await api(`/trees/${treeId}/people/${p.id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      alert(String((e as Error).message));
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
              onClick={() => handleDelete(p)}
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
          <Button asChild variant="outline" size="sm" className="uppercase tracking-widest">
            <Link to={`/tree/${treeId}`}>← Views</Link>
          </Button>
          <Button size="sm" onClick={() => setEditorState({ mode: "create", person: emptyForm(null) })} className="uppercase tracking-widest">
            + Root person
          </Button>
          <span className="ml-auto text-xs text-muted-foreground tracking-widest">
            {people.length} people · {user?.email} ({user?.role})
          </span>
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
    </div>
  );
}
