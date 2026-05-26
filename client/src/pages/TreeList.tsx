import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useTreeList } from "../hooks/useTreeList";
import type { Tree } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";

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
      setName("");
      setCreating(false);
      await refresh();
      navigate(`/tree/${created.id}/editor`);
    } catch (e) {
      setCreateError(String((e as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-5">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3 text-xs text-muted-foreground tracking-widest">
        {user && (
          <>
            <span>
              Signed in as <strong className="text-foreground">{user.email}</strong> ({user.role})
            </span>
            <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
          </>
        )}
        <ThemeToggle />
      </div>

      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-14">
          <h1 className="text-5xl text-primary uppercase tracking-[0.2em] font-semibold m-0">
            ◆ Your Trees ◆
          </h1>
          <div className="w-16 h-0.5 bg-primary mx-auto my-4" />
          <p className="text-base text-muted-foreground italic tracking-widest">
            Pick a tree or create a new one
          </p>
        </header>

        {loading && <p>Loading…</p>}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {trees && trees.length === 0 && (
          <p className="text-center mt-6 text-muted-foreground">
            You don't have any trees yet — create one below.
          </p>
        )}

        {trees && trees.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
            {trees.map((t) => (
              <Link key={t.id} to={`/tree/${t.id}`} className="block group">
                <Card className="h-full transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary">
                  <CardContent className="p-6">
                    <span className="text-4xl text-primary block mb-3">⌬</span>
                    <h2 className="text-xl text-primary uppercase tracking-widest font-semibold m-0 mb-2">
                      {t.name}
                    </h2>
                    <p className="text-sm m-0">
                      {t.peopleCount} {t.peopleCount === 1 ? "member" : "members"}
                      {t.ownerEmail && user?.role === "superadmin" && t.ownerId !== user.id
                        ? ` · owner: ${t.ownerEmail}`
                        : ""}
                    </p>
                    <span className="inline-block mt-3 px-3 py-0.5 text-[10px] text-primary uppercase tracking-widest border border-border rounded bg-primary/10">
                      Open
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button onClick={() => setCreating(true)} className="uppercase tracking-widest">
            + New Tree
          </Button>
        </div>
      </div>

      <Dialog open={creating} onOpenChange={(open) => { if (!open) { setCreating(false); setCreateError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-primary">
              Create a new tree
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="tree-name" className="uppercase tracking-widest text-xs text-secondary">
                Name *
              </Label>
              <Input
                id="tree-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mouradyan Side"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
