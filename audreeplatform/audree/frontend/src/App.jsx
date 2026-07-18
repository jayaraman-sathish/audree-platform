import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ChatProvider } from "./context/ChatContext";
import Login from "./pages/Login";
import CommandWorkspace from "./pages/CommandWorkspace";
import Copilot from "./pages/Copilot";
import ScenarioStudio from "./pages/ScenarioStudio";
import Scenarios from "./pages/Scenarios";
import Masters from "./pages/Masters";
import Architecture from "./pages/Architecture";
import AuditLog from "./pages/AuditLog";
import logo from "./assets/audree-logo.svg";

// Nav labels below follow the approved mockup naming. Every existing page
// and route is kept -- this is a relabel/re-icon pass, nothing was removed.
// "Agents & Tools" and "Integrations" point at the existing Configuration
// Masters and Platform Architecture pages respectively (closest functional
// match) rather than being new blank pages.
function Shell({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><img src={logo} alt="Audree" style={{ height: 34 }} /></div>
        <div className="brand-sub">AGENTIC AI PLATFORM</div>
        <div className="navgroup">BUSINESS USER · RUNTIME</div>
        <NavLink className="navbtn" to="/copilot">💬 Enterprise Copilot</NavLink>
        <NavLink className="navbtn" to="/">▦ Command Workspace</NavLink>
        <div className="navgroup">PLATFORM ADMIN · DESIGN-TIME</div>
        <NavLink className="navbtn" to="/studio">✚ Scenario Studio</NavLink>
        <NavLink className="navbtn" to="/scenarios">◈ Scenarios</NavLink>
        <NavLink className="navbtn" to="/masters">🤖 Agents &amp; Tools</NavLink>
        <NavLink className="navbtn" to="/architecture">🔗 Integrations</NavLink>
        <NavLink className="navbtn" to="/audit">🛡 Governance &amp; Audit</NavLink>
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
      <ChatProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Private><CommandWorkspace /></Private>} />
          <Route path="/copilot" element={<Private><Copilot /></Private>} />
          <Route path="/studio" element={<Private><ScenarioStudio /></Private>} />
          <Route path="/scenarios" element={<Private><Scenarios /></Private>} />
          <Route path="/masters" element={<Private><Masters /></Private>} />
          <Route path="/architecture" element={<Private><Architecture /></Private>} />
          <Route path="/audit" element={<Private><AuditLog /></Private>} />
        </Routes>
      </ChatProvider>
    </BrowserRouter>
  );
}
