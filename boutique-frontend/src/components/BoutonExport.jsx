import { useState } from 'react';
import { useApi } from '../useApi.js';
import { useT } from '../i18n.jsx';
import { telecharger } from '../csv.js';
import Icone from '../icons.jsx';

// Télécharge un export CSV de l'API (réservé admin) : ouvrable directement dans Excel
export default function BoutonExport({ ressource }) {
  const appeler = useApi();
  const { t } = useT();
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function exporter() {
    setErreur('');
    setEnCours(true);
    try {
      const blob = await appeler(`/api/export/${ressource}`, { blob: true });
      telecharger(blob, `${ressource}.csv`);
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <button className="btn btn-light" onClick={exporter} disabled={enCours}>
        <Icone nom="telecharger" taille={16} />{t('export.csv')}
      </button>
      {erreur && <span className="erreur petit">{erreur}</span>}
    </>
  );
}
