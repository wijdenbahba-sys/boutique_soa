import { Fragment, useEffect, useState } from 'react';
import { useApi } from '../../useApi.js';
import { STATUTS, formaterDate, formaterPrix } from '../../utils.js';

// Statuts qu'un admin peut choisir dans la liste (l'annulation a son propre bouton : elle remet le stock)
const STATUTS_CHOISISSABLES = ['en_attente', 'confirmee', 'expediee', 'livree'];

export default function AdminCommandes() {
  const appeler = useApi();
  const [commandes, setCommandes] = useState([]);
  const [filtre, setFiltre] = useState('');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [ouverte, setOuverte] = useState(null); // commande dont le détail est affiché
  const [details, setDetails] = useState({}); // détails déjà chargés

  // Recharge la liste à chaque changement de filtre (GET /api/commandes?statut=...)
  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur('');
    appeler(`/api/commandes${filtre ? `?statut=${filtre}` : ''}`)
      .then((data) => { if (!annule) setCommandes(data); })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [appeler, filtre]);

  async function changerStatut(commande, statut) {
    setErreur('');
    setSucces('');
    try {
      await appeler(`/api/commandes/${commande.id}/statut`, { method: 'PATCH', body: { statut } });
      setCommandes((courant) => courant.map((c) => (c.id === commande.id ? { ...c, statut } : c)));
      setSucces(`Commande n°${commande.id} : statut « ${STATUTS[statut].texte} ».`);
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  async function annuler(commande) {
    if (!window.confirm(`Annuler la commande n°${commande.id} ? Le stock sera remis à jour.`)) return;
    setErreur('');
    setSucces('');
    try {
      await appeler(`/api/commandes/${commande.id}/annuler`, { method: 'PATCH' });
      setCommandes((courant) => courant.map((c) => (c.id === commande.id ? { ...c, statut: 'annulee' } : c)));
      setSucces(`Commande n°${commande.id} annulée, stock remis à jour.`);
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  async function basculerDetail(id) {
    if (ouverte === id) {
      setOuverte(null);
      return;
    }
    setOuverte(id);
    if (details[id]) return;
    try {
      const data = await appeler(`/api/commandes/${id}`);
      setDetails((courant) => ({ ...courant, [id]: data }));
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  return (
    <>
      <div className="entete-section">
        <h1>Commandes</h1>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([cle, s]) => (
            <option key={cle} value={cle}>{s.texte}</option>
          ))}
        </select>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {succes && <p className="succes">{succes}</p>}
      {chargement && !erreur && <p className="muted">Chargement...</p>}

      {!chargement && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Date</th>
                <th>Total</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {commandes.length === 0 && (
                <tr><td colSpan="6" className="muted">Aucune commande.</td></tr>
              )}
              {commandes.map((c) => {
                const st = STATUTS[c.statut] || { texte: c.statut, classe: '' };
                const annulable = c.statut === 'en_attente' || c.statut === 'confirmee';
                const detail = details[c.id];
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td><strong>{c.id}</strong></td>
                      <td>
                        {c.client_nom}
                        <div className="muted petit">{c.client_email}</div>
                      </td>
                      <td>{formaterDate(c.date_commande)}</td>
                      <td>{formaterPrix(c.total)}</td>
                      <td>
                        {c.statut === 'annulee' ? (
                          <span className={`badge ${st.classe}`}>{st.texte}</span>
                        ) : (
                          <select
                            value={c.statut}
                            aria-label={`Statut de la commande ${c.id}`}
                            onChange={(e) => changerStatut(c, e.target.value)}
                          >
                            {STATUTS_CHOISISSABLES.map((cle) => (
                              <option key={cle} value={cle}>{STATUTS[cle].texte}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <div className="actions-ligne">
                          <button className="btn btn-light btn-small" onClick={() => basculerDetail(c.id)}>
                            {ouverte === c.id ? 'Masquer' : 'Détail'}
                          </button>
                          {annulable && (
                            <button className="btn btn-light btn-small btn-danger" onClick={() => annuler(c)}>Annuler</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {ouverte === c.id && (
                      <tr className="ligne-detail">
                        <td colSpan="6">
                          {!detail ? (
                            <span className="muted">Chargement du détail...</span>
                          ) : (
                            <table className="commande-lignes">
                              <thead>
                                <tr><th>Produit</th><th>Quantité</th><th>Prix unitaire</th><th>Sous-total</th></tr>
                              </thead>
                              <tbody>
                                {detail.lignes.map((l) => (
                                  <tr key={l.id}>
                                    <td>{l.produit_nom}</td>
                                    <td>{l.quantite}</td>
                                    <td>{formaterPrix(l.prix_unitaire)}</td>
                                    <td>{formaterPrix(l.sous_total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
