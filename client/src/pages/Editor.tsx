import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Person, TreeNode } from "../types";
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
  onCancel,
  onSave,
}: {
  initial: FormState;
  title: string;
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
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {error && <div style={{ color: "var(--coral)", fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <label>Name *</label>
        <input value={form.name} onChange={(e) => update("name", e.target.value)} required />

        <div className="row">
          <div>
            <label>Gender</label>
            <select value={form.gender ?? ""} onChange={(e) => update("gender", e.target.value || null)}>
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label>Nickname</label>
            <input value={form.nickname ?? ""} onChange={(e) => update("nickname", e.target.value || null)} />
          </div>
        </div>

        <div className="row">
          <div>
            <label>Surname (birth)</label>
            <input value={form.surnameBirth ?? ""} onChange={(e) => update("surnameBirth", e.target.value || null)} />
          </div>
          <div>
            <label>Surname (now)</label>
            <input value={form.surnameNow ?? ""} onChange={(e) => update("surnameNow", e.target.value || null)} />
          </div>
        </div>

        <div className="row">
          <div>
            <label>Birth year</label>
            <input
              type="number"
              value={form.birthYear ?? ""}
              onChange={(e) => update("birthYear", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <label>Death year</label>
            <input
              type="number"
              value={form.deathYear ?? ""}
              onChange={(e) => update("deathYear", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        </div>

        <div className="row">
          <div>
            <label>Birth place</label>
            <input value={form.birthPlace ?? ""} onChange={(e) => update("birthPlace", e.target.value || null)} />
          </div>
          <div>
            <label>Death place</label>
            <input value={form.deathPlace ?? ""} onChange={(e) => update("deathPlace", e.target.value || null)} />
          </div>
        </div>

        <label>Partner name</label>
        <input value={form.partnerName ?? ""} onChange={(e) => update("partnerName", e.target.value || null)} />

        <label>Profession</label>
        <input value={form.profession ?? ""} onChange={(e) => update("profession", e.target.value || null)} />

        <label>Deceased</label>
        <select value={form.deceased ?? ""} onChange={(e) => update("deceased", e.target.value || null)}>
          <option value="">—</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>

        <label>Notes / Bio</label>
        <textarea value={form.bio ?? ""} onChange={(e) => update("bio", e.target.value || null)} />

        <div className="footer">
          <button onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="primary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

type EditorState = { mode: "create" | "edit"; person: FormState; id?: string } | null;

export function Editor() {
  const { treeId } = useParams();
  const { user, logout } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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
    // Strip fields the API doesn't accept (id is set server-side on create; timestamps are read-only)
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
          <span className="editor-actions">
            <button
              className="add"
              onClick={() => setEditorState({ mode: "create", person: emptyForm(p.id) })}
              title="Add child"
            >
              + Child
            </button>
            <button onClick={() => setEditorState({ mode: "edit", person: { ...(p as any), name: p.name }, id: p.id })}>
              Edit
            </button>
            <button className="del" onClick={() => handleDelete(p)}>Delete</button>
          </span>
        </span>
        {kids.length > 0 && !isCollapsed && (
          <ul>{kids.map((c) => renderNode(c, depth + 1))}</ul>
        )}
      </li>
    );
  }

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (error) return <div style={{ padding: 40, color: "var(--coral)" }}>Error: {error}</div>;

  return (
    <div className="view-shell">
      <header className="view-header">
        <h1>◆ Editor</h1>
        <Link className="btn" to={`/tree/${treeId}`}>← Views</Link>
        <button onClick={() => setEditorState({ mode: "create", person: emptyForm(null) })}>+ Root person</button>
        <span className="stats">
          {people.length} people · {user?.email} ({user?.role})
          <button style={{ marginLeft: 12 }} onClick={logout}>Logout</button>
        </span>
      </header>

      <div className="editor-wrap">
        <ul className="tree-list">{roots.map((r) => renderNode(r, 0))}</ul>
      </div>

      {editorState && (
        <PersonForm
          initial={editorState.person}
          title={editorState.mode === "create" ? "Add person" : `Edit ${editorState.person.name}`}
          onCancel={() => setEditorState(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
