import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useTree, allRoots, flattenTree } from "../hooks/useTree";
import { useTreeContext } from "../tree/TreeContext";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";

type ViewCard = {
  to: string;
  icon: string;
  title: string;
  desc: string;
  tag: string;
  variant?: "editor";
};

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

  const views: ViewCard[] = [
    { to: `/tree/${tree.id}/list`, icon: "≡", title: "Indented List", desc: "Classic expandable tree with names, dates, and full details.", tag: "Compact" },
    { to: `/tree/${tree.id}/chart`, icon: "⌬", title: "Genealogical Chart", desc: "Top-down chart with horizontal generations. Pan and zoom.", tag: "Classic" },
    { to: `/tree/${tree.id}/illustrated`, icon: "❀", title: "Illustrated Tree", desc: "Stylised fractal tree on a dark background.", tag: "Artistic" },
    { to: `/tree/${tree.id}/compact`, icon: "▼", title: "Compact Illustrated", desc: "Same style with tight spacing.", tag: "Recommended" },
    { to: `/tree/${tree.id}/editor`, icon: "✎", title: "Editor", desc: "Add, edit, and delete people. All changes save directly.", tag: "Edit", variant: "editor" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-5">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3 text-xs text-muted-foreground tracking-widest">
        <Link to="/" className="text-primary hover:underline">← All trees</Link>
        {user && (
          <>
            <span>·</span>
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
            ◆ {tree.name} ◆
          </h1>
          <div className="w-16 h-0.5 bg-primary mx-auto my-4" />
          <p className="text-base text-muted-foreground italic tracking-widest">Choose a view</p>
        </header>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
          {views.map((v) => {
            const isEditor = v.variant === "editor";
            return (
              <Link key={v.to} to={v.to} className="block group">
                <Card className={`h-full transition-all hover:-translate-y-1 hover:shadow-lg ${isEditor ? "hover:border-destructive" : "hover:border-primary"}`}>
                  <CardContent className="p-6">
                    <span className={`text-4xl block mb-3 ${isEditor ? "text-destructive" : "text-primary"}`}>{v.icon}</span>
                    <h2 className={`text-xl uppercase tracking-widest font-semibold m-0 mb-2 ${isEditor ? "text-destructive" : "text-primary"}`}>{v.title}</h2>
                    <p className="text-sm m-0">{v.desc}</p>
                    <span className={`inline-block mt-3 px-3 py-0.5 text-[10px] uppercase tracking-widest border rounded ${isEditor ? "text-destructive border-destructive bg-destructive/10" : "text-primary border-border bg-primary/10"}`}>
                      {v.tag}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <footer className="text-center mt-14 text-sm text-muted-foreground uppercase tracking-widest">
          {peopleCount} members{rootName ? ` · descended from ${rootName}` : ""}
          {" · "}
          <button onClick={() => setConfirmDelete(true)} className="text-destructive hover:underline">
            Delete tree
          </button>
        </footer>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(open) => { if (!open) { setConfirmDelete(false); setErr(null); setTypedName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-primary">
              Delete "{tree.name}"?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>This deletes the tree and all {peopleCount} people in it. There is no undo.</p>
            <p>Type the tree name to confirm:</p>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={tree.name}
            />
            {err && (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteThisTree} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
