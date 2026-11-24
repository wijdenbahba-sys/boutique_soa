import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { api } from './api.js';

// Garde en mémoire les ids des produits favoris du client connecté (pour colorer les cœurs).
const FavorisContext = createContext(null);

export function FavorisProvider({ children }) {
  const { user, token } = useAuth();
  const [ids, setIds] = useState([]);
  const estClient = user?.role === 'client';

  useEffect(() => {
    if (!estClient) { setIds([]); return; }
    api('/api/favoris/ids', { token }).then((r) => setIds(Array.isArray(r) ? r : [])).catch(() => setIds([]));
  }, [estClient, token]);

  const basculer = useCallback(async (produitId) => {
    const etaitFavori = ids.includes(produitId);
    // Mise à jour immédiate de l'écran, puis on prévient l'API (on annule si elle échoue)
    setIds((c) => (etaitFavori ? c.filter((i) => i !== produitId) : [...c, produitId]));
    try {
      await api(`/api/favoris/${produitId}`, { method: etaitFavori ? 'DELETE' : 'POST', token });
    } catch {
      setIds((c) => (etaitFavori ? [...c, produitId] : c.filter((i) => i !== produitId)));
    }
  }, [ids, token]);

  const valeur = useMemo(() => ({ ids, estFavori: (id) => ids.includes(id), basculer, actif: estClient }), [ids, basculer, estClient]);
  return <FavorisContext.Provider value={valeur}>{children}</FavorisContext.Provider>;
}

export function useFavoris() {
  return useContext(FavorisContext);
}
