import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useTree, allRoots, flattenTree } from "../hooks/useTree";
import { useTreeContext } from "../tree/TreeContext";
import "../styles/chooser.css";

export function TreeChooser() {
  const tree = useTreeContext();
  const { user, logout } = useAuth();
  const { tree: nestedTree } = useTree(tree.id);
  const navigate = useNavigate();
  const peopleCount = Object.keys(flattenTree(nestedTree)).length;
  const rootName = allRoots(nestedTree)[0]?.name ?? "";

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function deleteThisTree() {
    if (typedName !== tree.name) {
      setErr("Type the tree name exactly to confirm.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/trees/${tree.id}`, { method: "DELETE" });
      navigate("/");
    } catch (e) {
      setErr(String((e as Error).message));
      setBusy(false);
    }
  }

  return (
    <div className="chooser">
      <div className="userbar">
        <Link to="/">← All trees</Link>
        {user && (
          <>
            <span> · </span>
            Signed in as <strong style={{ color: "var(--ink)" }}>{user.email}</strong> ({user.role})
            <button onClick={logout}>Logout</button>
          </>
        )}
      </div>

      <div className="container">
        <header>
          <h1>◆ {tree.name} ◆</h1>
          <div className="divider" />
          <p className="subtitle">Choose a view</p>
        </header>

        <div className="grid">
          <Link className="card" to={`/tree/${tree.id}/list`}>
            <span className="icon">≡</span>
            <h2>Indented List</h2>
            <p>Classic expandable tree with names, dates, and full details.</p>
            <span className="tag">Compact</span>
          </Link>
          <Link className="card" to={`/tree/${tree.id}/chart`}>
            <span className="icon">⌬</span>
            <h2>Genealogical Chart</h2>
            <p>Top-down chart with horizontal generations. Pan and zoom.</p>
            <span className="tag">Classic</span>
          </Link>
          <Link className="card" to={`/tree/${tree.id}/illustrated`}>
            <span className="icon">❀</span>
            <h2>Illustrated Tree</h2>
            <p>Stylised fractal tree on a dark background.</p>
            <span className="tag">Artistic</span>
          </Link>
          <Link className="card" to={`/tree/${tree.id}/compact`}>
            <span className="icon">▼</span>
            <h2>Compact Illustrated</h2>
            <p>Same style with tight spacing.</p>
            <span className="tag">Recommended</span>
          </Link>
          <Link className="card editor" to={`/tree/${tree.id}/editor`}>
            <span className="icon">✎</span>
            <h2>Editor</h2>
            <p>Add, edit, and delete people. All changes save directly.</p>
            <span className="tag">Edit</span>
          </Link>
        </div>

        <footer>
          {peopleCount} members{rootName ? ` · descended from ${rootName}` : ""}{" "}
          · <button onClick={() => setConfirmDelete(true)} style={{ color: "var(--coral)" }}>Delete tree</button>
        </footer>

        {confirmDelete && (
          <div className="modal-backdrop" onClick={() => setConfirmDelete(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Delete "{tree.name}"?</h3>
              <p>This deletes the tree and all {peopleCount} people in it. There is no undo.</p>
              <p>Type the tree name to confirm:</p>
              <input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={tree.name} />
              {err && <div style={{ color: "var(--coral)", fontSize: 12, marginTop: 8 }}>{err}</div>}
              <div className="footer">
                <button onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
                <button className="primary" onClick={deleteThisTree} disabled={busy}>
                  {busy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
