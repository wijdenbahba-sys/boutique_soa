import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icone from './icons.jsx';

// Petites notifications qui apparaissent en bas de l'écran puis disparaissent toutes seules.
//   const { toast } = useToast();   toast('Produit enregistré');   toast('Erreur', { type: 'erreur' })
const ToastContext = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const [liste, setListe] = useState([]);
  const compteur = useRef(0);

  const retirer = useCallback((id) => setListe((l) => l.filter((x) => x.id !== id)), []);

  const toast = useCallback((texte, { type = 'info', duree = 4500, icone } = {}) => {
    const id = ++compteur.current;
    setListe((l) => [...l.slice(-3), { id, texte, type, icone }]); // 4 toasts maximum à l'écran
    if (duree) setTimeout(() => retirer(id), duree);
    return id;
  }, [retirer]);

  const valeur = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={valeur}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {liste.map((x) => (
          <div key={x.id} className={`toast toast-${x.type}`}>
            {x.icone && <Icone nom={x.icone} taille={18} />}
            <span>{x.texte}</span>
            <button type="button" className="toast-fermer" onClick={() => retirer(x.id)} aria-label="×">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
