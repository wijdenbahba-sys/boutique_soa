import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from './api.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './Toasts.jsx';
import { useT } from './i18n.jsx';
import { formaterPrix } from './utils.js';

// Temps réel pour l'administrateur : connexion Server-Sent Events à GET /api/evenements/flux.
// EventSource ne sait pas envoyer l'en-tête Authorization : on lit donc le flux avec fetch (ReadableStream).
// Reconnexion automatique avec délai croissant. Chaque événement : liste + compteur "non lus" + toast.
const EvenementsContext = createContext({ evenements: [], nonLus: 0, connecte: false, marquerLus: () => {}, abonner: () => () => {} });

// Texte lisible pour un événement (clés de traduction evt.<type>)
export function decrire(ev, t) {
  const d = ev.donnees || {};
  switch (ev.type) {
    case 'commande.creee': return t('evt.commande.creee', { id: d.id, client: d.client_nom || '?', total: formaterPrix(d.total || 0) });
    case 'commande.statut': return t('evt.commande.statut', { id: d.id, statut: t(`statut.${d.nouveau}`) });
    case 'commande.annulee': return t('evt.commande.annulee', { id: d.id });
    case 'stock.bas': return t('evt.stock.bas', { nom: d.nom, stock: d.stock });
    case 'achat.recu': return t('evt.achat.recu', { id: d.id });
    case 'avis.cree': return t('evt.avis.cree', { nom: d.nom, note: d.note });
    default: return ev.type;
  }
}
export const ICONES_EVENEMENT = {
  'commande.creee': 'commandes', 'commande.statut': 'camion', 'commande.annulee': 'commandes',
  'stock.bas': 'produits', 'achat.recu': 'achats', 'avis.cree': 'etoile',
};

export function EvenementsProvider({ children }) {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const { t } = useT();
  const [evenements, setEvenements] = useState([]);
  const [nonLus, setNonLus] = useState(0);
  const [connecte, setConnecte] = useState(false);
  const auditeurs = useRef(new Set());
  const tRef = useRef(t);
  tRef.current = t;
  const estAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!estAdmin || !token) { setEvenements([]); setNonLus(0); setConnecte(false); return undefined; }
    let stop = false;
    const controleur = new AbortController();
    let essai = 0;

    // Historique récent (les 50 derniers), pour que le fil ne soit pas vide à l'ouverture
    fetch(`${API_URL}/api/evenements`, { headers: { Authorization: `Bearer ${token}` }, signal: controleur.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((liste) => { if (!stop && Array.isArray(liste)) setEvenements(liste); })
      .catch(() => {});

    function recu(ev) {
      setEvenements((l) => (l.some((x) => x.id === ev.id) ? l : [ev, ...l].slice(0, 50)));
      setNonLus((n) => n + 1);
      const type = ev.type === 'stock.bas' || ev.type === 'commande.annulee' ? 'alerte' : ev.type === 'commande.creee' ? 'succes' : 'info';
      toast(decrire(ev, tRef.current), { type, icone: ICONES_EVENEMENT[ev.type] });
      auditeurs.current.forEach((f) => f(ev));
    }

    async function connecter() {
      while (!stop) {
        try {
          const rep = await fetch(`${API_URL}/api/evenements/flux`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
            signal: controleur.signal,
          });
          if (!rep.ok || !rep.body) throw new Error(`HTTP ${rep.status}`);
          setConnecte(true);
          essai = 0;
          const lecteur = rep.body.getReader();
          const decodeur = new TextDecoder();
          let tampon = '';
          for (;;) {
            const { done, value } = await lecteur.read();
            if (done) break;
            tampon += decodeur.decode(value, { stream: true });
            let fin;
            while ((fin = tampon.indexOf('\n\n')) >= 0) {
              const bloc = tampon.slice(0, fin);
              tampon = tampon.slice(fin + 2);
              const ligne = bloc.split('\n').find((l) => l.startsWith('data: '));
              if (ligne) { try { recu(JSON.parse(ligne.slice(6))); } catch { /* bloc illisible : ignoré */ } }
            }
          }
        } catch (err) {
          if (stop || err.name === 'AbortError') return;
        }
        setConnecte(false);
        essai += 1;
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** essai, 15000)));
      }
    }
    connecter();
    return () => { stop = true; controleur.abort(); };
  }, [estAdmin, token, toast]);

  const marquerLus = useCallback(() => setNonLus(0), []);
  const abonner = useCallback((f) => { auditeurs.current.add(f); return () => auditeurs.current.delete(f); }, []);
  const valeur = useMemo(() => ({ evenements, nonLus, connecte, marquerLus, abonner }), [evenements, nonLus, connecte, marquerLus, abonner]);
  return <EvenementsContext.Provider value={valeur}>{children}</EvenementsContext.Provider>;
}

export const useEvenements = () => useContext(EvenementsContext);
