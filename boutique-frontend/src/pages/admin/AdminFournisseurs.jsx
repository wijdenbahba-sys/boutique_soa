import { useEffect, useState } from 'react';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';

const VIDE = { nom: '', email: '', telephone: '', adresse: '' };

// Gestion des fournisseurs : GET/POST/PUT/DELETE /api/fournisseurs
export default function AdminFournisseurs() {
  const appeler = useApi();
  const { t } = useT();
  const [fournisseurs, setFournisseurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [nouveau, setNouveau] = useState(VIDE);
  const [edition, setEdition] = useState(null); // fournisseur en cours de modification

  useEffect(() => {
    let annule = false;
    appeler('/api/fournisseurs')
      .then((data) => { if (!annule) setFournisseurs(data); })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [appeler]);

  const trier = (liste) => [...liste].sort((a, b) => a.nom.localeCompare(b.nom));

  async function ajouter(e) {
    e.preventDefault();
    setErreur('');
    setSucces('');
    try {
      const cree = await appeler('/api/fournisseurs', { method: 'POST', body: nouveau });
      setFournisseurs((courant) => trier([...courant, cree]));
      setNouveau(VIDE);
      setSucces(t('fournisseurs.ajoute', { nom: cree.nom }));
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  async function enregistrer() {
    setErreur('');
    setSucces('');
    try {
      const maj = await appeler(`/api/fournisseurs/${edition.id}`, {
        method: 'PUT',
        body: { nom: edition.nom, email: edition.email, telephone: edition.telephone, adresse: edition.adresse },
      });
      setFournisseurs((courant) => trier(courant.map((f) => (f.id === maj.id ? { ...f, ...maj } : f))));
      setEdition(null);
      setSucces(t('fournisseurs.modifie', { nom: maj.nom }));
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  async function supprimer(f) {
    if (!window.confirm(t('fournisseurs.confirmer', { nom: f.nom }))) return;
    setErreur('');
    setSucces('');
    try {
      await appeler(`/api/fournisseurs/${f.id}`, { method: 'DELETE' });
      setFournisseurs((courant) => courant.filter((x) => x.id !== f.id));
      setSucces(t('fournisseurs.supprime', { nom: f.nom }));
    } catch (err) {
      if (err.status !== 401) setErreur(err.message); // ex : le fournisseur a des achats (409)
    }
  }

  const champ = (objet, setter, nom) => ({
    value: objet[nom] || '',
    onChange: (e) => setter({ ...objet, [nom]: e.target.value }),
  });

  return (
    <>
      <h1>{t('fournisseurs.titre')}</h1>

      <form className="card ajout-fournisseur" onSubmit={ajouter}>
        <label>{t('commun.nom')}<input {...champ(nouveau, setNouveau, 'nom')} required /></label>
        <label>{t('commun.email')}<input type="email" {...champ(nouveau, setNouveau, 'email')} /></label>
        <label>{t('fournisseurs.telephone')}<input {...champ(nouveau, setNouveau, 'telephone')} /></label>
        <label>{t('fournisseurs.adresse')}<input {...champ(nouveau, setNouveau, 'adresse')} /></label>
        <button className="btn">{t('commun.ajouter')}</button>
      </form>

      {erreur && <p className="erreur section-espace">{erreur}</p>}
      {succes && <p className="succes section-espace">{succes}</p>}
      {chargement && !erreur && <p className="muted">{t('commun.chargement')}</p>}

      {!chargement && (
        <div className="card table-wrap section-espace">
          <table>
            <thead>
              <tr>
                <th>{t('commun.nom')}</th><th>{t('commun.email')}</th><th>{t('fournisseurs.telephone')}</th><th>{t('fournisseurs.adresse')}</th><th></th>
              </tr>
            </thead>
            <tbody>
              {fournisseurs.length === 0 && (
                <tr><td colSpan="5" className="muted">{t('fournisseurs.aucun')}</td></tr>
              )}
              {fournisseurs.map((f) =>
                edition?.id === f.id ? (
                  <tr key={f.id}>
                    <td><input aria-label={t('commun.nom')} {...champ(edition, setEdition, 'nom')} /></td>
                    <td><input aria-label={t('commun.email')} type="email" {...champ(edition, setEdition, 'email')} /></td>
                    <td><input aria-label={t('fournisseurs.telephone')} {...champ(edition, setEdition, 'telephone')} /></td>
                    <td><input aria-label={t('fournisseurs.adresse')} {...champ(edition, setEdition, 'adresse')} /></td>
                    <td>
                      <div className="actions-ligne">
                        <button className="btn btn-small" onClick={enregistrer}>{t('commun.enregistrer')}</button>
                        <button className="btn btn-light btn-small" onClick={() => setEdition(null)}>{t('commun.annuler')}</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={f.id}>
                    <td><strong>{f.nom}</strong></td>
                    <td>{f.email || <span className="muted">—</span>}</td>
                    <td><span dir="ltr">{f.telephone || '—'}</span></td>
                    <td>{f.adresse || <span className="muted">—</span>}</td>
                    <td>
                      <div className="actions-ligne">
                        <button className="btn btn-light btn-small" onClick={() => setEdition({ ...f })}>{t('commun.modifier')}</button>
                        <button className="btn btn-light btn-small btn-danger" onClick={() => supprimer(f)}>{t('commun.supprimer')}</button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
