import { createContext, useContext, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("audree_user");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(username, password) {
    const form = new URLSearchParams();
    form.set("username", username);
    form.set("password", password);
    const res = await api.post("/api/v1/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    localStorage.setItem("audree_token", res.data.access_token);
    const u = { username: res.data.username, role: res.data.role, full_name: res.data.full_name };
    localStorage.setItem("audree_user", JSON.stringify(u));
    setUser(u);
    return u;
  }

  function logout() {
    localStorage.removeItem("audree_token");
    localStorage.removeItem("audree_user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
