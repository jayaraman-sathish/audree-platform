import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      nav("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand" style={{ color: "var(--ink)" }}><span className="dot" /> AUDREE</div>
        <p className="hint" style={{ marginBottom: 16 }}>Enterprise Agentic AI Platform — sign in</p>
        <label htmlFor="u">Username</label>
        <input id="u" type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={{ marginBottom: 12 }} />
        <label htmlFor="p">Password</label>
        <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 16 }} />
        <button className="btn primary" style={{ width: "100%" }} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {error && <div className="error">{error}</div>}
        <p className="hint" style={{ marginTop: 14 }}>
          Demo users: admin/admin123 · ppic.user/ppic123 · ppic.head/ppic123 · qa.head/qa123 · md/md123
        </p>
      </form>
    </div>
  );
}
