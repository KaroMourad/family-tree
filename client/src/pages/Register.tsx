import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "../styles/views.css";

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
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>◆ Register ◆</h2>
        {error && <div className="error">{error}</div>}
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password (min 6 chars)</label>
        <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        <div className="alt">
          Already have an account? <Link to="/login">Login</Link> · <Link to="/">Back</Link>
        </div>
        <div className="alt" style={{ marginTop: 8, fontSize: 11 }}>
          New accounts are viewers. An admin must promote you (run{" "}
          <code>pnpm create-admin you@example.com password</code> on the server) to use the editor.
        </div>
      </form>
    </div>
  );
}
