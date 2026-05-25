import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(email, password);
      nav("/");
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-5 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center uppercase tracking-[0.2em] text-primary text-lg">
            ◆ Register ◆
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="uppercase tracking-widest text-xs text-secondary">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="uppercase tracking-widest text-xs text-secondary">
                Password (min 6 chars)
              </Label>
              <Input
                id="password"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full uppercase tracking-widest">
              {busy ? "Creating…" : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground tracking-wider">
              Already have an account? <Link to="/login" className="text-primary hover:underline">Login</Link>
              {" · "}
              <Link to="/" className="text-primary hover:underline">Back</Link>
            </p>
            <p className="text-center text-[11px] text-muted-foreground tracking-wider">
              New accounts are viewers. An admin must promote you (run{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">pnpm create-admin you@example.com password</code>{" "}
              on the server) to use the editor.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
