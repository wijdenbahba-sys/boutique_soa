import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ar, fr } from './locales.js';
import { definirLangue } from './utils.js';

// Traduction maison, volontairement simple :
//   const { t } = useT();   t('panier.titre')   t('pagination.total', { n: 12 })
// Chaque texte de l'interface a une clé ; locales.js contient les textes français et arabes.
const DICTIONNAIRES = { fr, ar };
const LangContext = createContext(null);

function lireLangue() {
  try {
    const sauvee = localStorage.getItem('lang');
    if (sauvee === 'fr' || sauvee === 'ar') return sauvee;
  } catch {
    /* stockage bloqué : on garde le français */
  }
  return 'fr';
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(lireLangue);

  // Appelé pendant le rendu (et pas dans un effet) pour que les prix/dates utilisent déjà la bonne langue
  definirLangue(lang);

  // L'arabe s'écrit de droite à gauche : dir="rtl" retourne toute la mise en page
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('lang', lang);
    } catch {
      /* ignoré */
    }
  }, [lang]);

  const t = useCallback(
    (cle, variables) => {
      let texte = DICTIONNAIRES[lang][cle] ?? fr[cle] ?? cle;
      if (variables) {
        for (const [nom, valeur] of Object.entries(variables)) {
          texte = texte.split(`{${nom}}`).join(String(valeur));
        }
      }
      return texte;
    },
    [lang]
  );

  const valeur = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return <LangContext.Provider value={valeur}>{children}</LangContext.Provider>;
}

export function useT() {
  return useContext(LangContext);
}
