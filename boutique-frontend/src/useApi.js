import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { api } from './api.js';

// Hook pour appeler l'API en tant qu'utilisateur connecté.
// - ajoute automatiquement le token JWT
// - si le serveur répond 401 (token expiré, valable 1 jour) : déconnexion + retour à la page de connexion
// La fonction retournée est STABLE (même identité à chaque rendu) : on peut la mettre
// sans risque dans les dépendances d'un useEffect.
export function useApi() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // On garde les dernières valeurs dans une "ref" pour que la fonction ne change jamais
  const courant = useRef({});
  useEffect(() => {
    courant.current = { token, logout, navigate, chemin: location.pathname };
  });

  return useCallback(async (chemin, options = {}) => {
    try {
      return await api(chemin, { ...options, token: courant.current.token });
    } catch (err) {
      if (err.status === 401) {
        const { logout: deconnecter, navigate: aller, chemin: ici } = courant.current;
        deconnecter();
        aller('/login', { state: { from: ici, message: 'Votre session a expiré. Reconnectez-vous.' } });
      }
      throw err;
    }
  }, []);
}
