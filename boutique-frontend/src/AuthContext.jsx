import { createContext, useContext, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

// Lecture sécurisée du localStorage (peut échouer dans certains navigateurs)
function lireSession() {
  try {
    return {
      token: localStorage.getItem('token'),
      user: JSON.parse(localStorage.getItem('user') || 'null'),
    };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(lireSession);

  function sauvegarder(token, user) {
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } catch {
      /* si le stockage est bloqué, la session reste valable jusqu'au rechargement */
    }
    setSession({ token, user });
  }

  async function login(email, mot_de_passe) {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, mot_de_passe } });
    sauvegarder(data.token, data.user);
    return data.user;
  }

  async function register(nom, email, mot_de_passe) {
    await api('/api/auth/register', { method: 'POST', body: { nom, email, mot_de_passe } });
    // Après l'inscription, on connecte directement l'utilisateur
    return login(email, mot_de_passe);
  }

  function logout() {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {
      /* ignoré */
    }
    setSession({ token: null, user: null });
  }

  const valeur = { token: session.token, user: session.user, login, register, logout };
  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

// Hook pratique : const { user, login, logout } = useAuth();
export function useAuth() {
  return useContext(AuthContext);
}
