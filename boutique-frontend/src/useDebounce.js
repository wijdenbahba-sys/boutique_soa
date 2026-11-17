import { useEffect, useState } from 'react';

// Renvoie "valeur" seulement après "delai" ms sans changement
// (évite d'appeler l'API à chaque lettre tapée dans une recherche)
export function useDebounce(valeur, delai = 400) {
  const [retardee, setRetardee] = useState(valeur);
  useEffect(() => {
    const minuteur = setTimeout(() => setRetardee(valeur), delai);
    return () => clearTimeout(minuteur);
  }, [valeur, delai]);
  return retardee;
}
