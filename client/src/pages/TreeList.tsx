import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useTreeList } from "../hooks/useTreeList";
import type { Tree } from "../types";
import "../styles/chooser.css";

export function TreeList() {
  const { user, logout } = useAuth();
  const { trees, loading, error, refresh } = useTreeList();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setCreateError("Name is required");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      const created = await api<Tree>("/trees", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      await refresh();
      navigate(`/tree/${created.id}/editor`);
    } catch (e) {
      setCreateError(String((e as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="chooser">
      <div className="userbar">
        {user && (
          <>
            Signed in as <strong style={{ color: "var(--ink)" }}>{user.email}</strong> ({user.role})
            <button onClick={logout}>Logout</button>
          </>
        )}
      </div>

      <div className="container">
        <header>
          <h1>◆ Your Trees ◆</h1>
          <div className="divider" />
          <p className="subtitle">Pick a tree or create a new one</p>
        </header>

        {loading && <p>Loading…</p>}
        {error && <p style={{ color: "var(--coral)" }}>{error}</p>}

        {trees && trees.length === 0 && !creating && (
          <p style={{ textAlign: "center", marginTop: 24 }}>
            You don't have any trees yet.{" "}
            <button onClick={() => setCreating(true)}>Create your first tree</button>
          </p>
        )}

        {trees && trees.length > 0 && (
          <div className="grid">
            {trees.map((t) => (
              <Link key={t.id} className="card" to={`/tree/${t.id}`}>
                <span className="icon">⌬</span>
                <h2>{t.name}</h2>
                <p>
                  {t.peopleCount} {t.peopleCount === 1 ? "member" : "members"}
                  {t.ownerEmail && user?.role === "superadmin" && t.ownerId !== user.id
                    ? ` · owner: ${t.ownerEmail}`
                    : ""}
                </p>
                <span className="tag">Open</span>
              </Link>
            ))}
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: "center" }}>
          {!creating ? (
            <button onClick={() => setCreating(true)}>+ New Tree</button>
          ) : (
            <div className="modal-backdrop" onClick={() => setCreating(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>Create a new tree</h3>
                {createError && (
                  <div style={{ color: "var(--coral)", fontSize: 12, marginBottom: 8 }}>{createError}</div>
                )}
                <label>Name *</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mouradyan Side"
                />
                <div className="footer">
                  <button onClick={() => setCreating(false)} disabled={submitting}>Cancel</button>
                  <button className="primary" onClick={handleCreate} disabled={submitting}>
                    {submitting ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
