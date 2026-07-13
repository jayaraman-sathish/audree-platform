import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Copilot from "./pages/Copilot";
import ScenarioStudio from "./pages/ScenarioStudio";
import Scenarios from "./pages/Scenarios";
import Masters from "./pages/Masters";
import Architecture from "./pages/Architecture";
import AuditLog from "./pages/AuditLog";

function Shell({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="dot" /> AUDREE</div>
        <div className="brand-sub">ENTERPRISE AGENTIC AI PLATFORM</div>
        <div className="navgroup">BUSINESS USER · RUNTIME</div>
        <NavLink className="navbtn" to="/copilot">💬 Enterprise Copilot</NavLink>
        <div className="navgroup">PLATFORM ADMIN · DESIGN-TIME</div>
        <NavLink className="navbtn" to="/">▦ Dashboard</NavLink>
        <NavLink className="navbtn" to="/studio">✚ Scenario Studio</NavLink>
        <NavLink className="navbtn" to="/scenarios">◈ Business Scenarios</NavLink>
        <NavLink className="navbtn" to="/masters">⚙ Configuration Masters</NavLink>
        <NavLink className="navbtn" to="/architecture">⇅ Platform Architecture</NavLink>
        <NavLink className="navbtn" to="/audit">≡ Audit Log</NavLink>
        <div className="foot">
          {user ? `${user.full_name} · ${user.role}` : ""}<br />
          <button className="btn" style={{ marginTop: 8, color: "#DDE7E1" }} onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

function Private({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Private><Dashboard /></Private>} />
        <Route path="/copilot" element={<Private><Copilot /></Private>} />
        <Route path="/studio" element={<Private><ScenarioStudio /></Private>} />
        <Route path="/scenarios" element={<Private><Scenarios /></Private>} />
        <Route path="/masters" element={<Private><Masters /></Private>} />
        <Route path="/architecture" element={<Private><Architecture /></Private>} />
        <Route path="/audit" element={<Private><AuditLog /></Private>} />
      </Routes>
    </BrowserRouter>
  );
}
