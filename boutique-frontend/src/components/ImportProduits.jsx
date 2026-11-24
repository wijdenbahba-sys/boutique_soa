import { useRef, useState } from 'react';
import { useApi } from '../useApi.js';
import { useT } from '../i18n.jsx';
import { csvVersProduits } from '../csv.js';
import Icone from '../icons.jsx';

const MODELE = 'nom;description;prix;stock;seuil_alerte;categorie\nCasque audio;Casque sans fil;79.90;25;5;Téléphonie\nTapis de souris;Tapis XL;12.5;40;10;Informatique\n';

// Importe des produits depuis un fichier CSV : lecture dans le navigateur, validation complète côté API
export default function ImportProduits({ onTermine }) {
  const appeler = useApi();
  const { t } = useT();
  const champFichier = useRef(null);
  const [rapport, setRapport] = useState(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function choisirFichier(e) {
    const fichier = e.target.files?.[0];
    e.target.value = ''; // permet de re-choisir le même fichier ensuite
    if (!fichier) return;
    setErreur(''); setRapport(null);
    try {
      const produits = csvVersProduits(await fichier.text());
      if (produits.length === 0) return setErreur(t('import.vide'));
      if (produits.length > 500) return setErreur(t('import.trop'));
      setEnCours(true);
      const r = await appeler('/api/produits/import', { method: 'POST', body: { produits } });
      setRapport(r);
      onTermine?.();
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  function telechargerModele() {
    const blob = new Blob(['﻿' + MODELE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modele-import-produits.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <div>
      <div className="outils-import">
        <input ref={champFichier} type="file" accept=".csv,text/csv" hidden onChange={choisirFichier} />
        <button className="btn btn-light" onClick={() => champFichier.current.click()} disabled={enCours}>
          <Icone nom="televerser" taille={16} />{enCours ? t('import.encours') : t('import.bouton')}
        </button>
        <button className="btn btn-light btn-small" onClick={telechargerModele}>{t('import.modele')}</button>
      </div>
      {erreur && <p className="erreur section-espace">{erreur}</p>}
      {rapport && (
        <div className="rapport-import">
          <p className="succes" style={{ margin: 0 }}>{t('import.resultat', { importes: rapport.importes, ignores: rapport.ignores })}</p>
          {rapport.erreurs?.length > 0 && (
            <ul>{rapport.erreurs.map((e, i) => <li key={i}>{t('import.ligne', { n: e.ligne })} : {e.message}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}
