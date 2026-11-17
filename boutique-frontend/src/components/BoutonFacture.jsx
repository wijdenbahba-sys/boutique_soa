import { useState } from 'react';
import { useApi } from '../useApi.js';
import { useT } from '../i18n.jsx';

// Télécharge la facture PDF d'une commande (GET /api/commandes/:id/facture).
// Le PDF est protégé par le token JWT : un simple lien <a href> ne pourrait pas l'envoyer,
// donc on récupère le fichier avec fetch, puis on l'ouvre dans un nouvel onglet.
export default function BoutonFacture({ commandeId }) {
  const appeler = useApi();
  const { t } = useT();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function ouvrir() {
    setErreur('');
    setEnCours(true);
    // On ouvre l'onglet tout de suite (pendant le clic) : sinon le navigateur bloque la fenêtre
    const fenetre = window.open('', '_blank');
    try {
      const fichier = await appeler(`/api/commandes/${commandeId}/facture`, { blob: true });
      const url = URL.createObjectURL(fichier);
      if (fenetre) {
        fenetre.location.href = url;
      } else {
        // Fenêtre bloquée : on télécharge le fichier à la place
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = `facture-${String(commandeId).padStart(5, '0')}.pdf`;
        lien.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (fenetre) fenetre.close();
      if (err.status !== 401) setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <button className="btn btn-light btn-small" onClick={ouvrir} disabled={enCours}>
        {enCours ? t('facture.chargement') : t('facture.bouton')}
      </button>
      {erreur && <span className="erreur petit">{erreur}</span>}
    </>
  );
}
