import BoutonExport from '../../components/BoutonExport.jsx';
import { Fragment, useEffect, useState } from 'react';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import BoutonFacture from '../../components/BoutonFacture.jsx';
import Pagination from '../../components/Pagination.jsx';
import { STATUTS, formaterDate, formaterPrix } from '../../utils.js';

// Statuts qu'un admin peut choisir dans la liste (l'annulation a son propre bouton : elle remet le stock)
const STATUTS_CHOISISSABLES = ['en_attente', 'confirmee', 'expediee', 'livree'];
const PAR_PAGE = 10;
const CLASSES_PAIEMENT = { paye: 'badge-ok', en_attente: 'badge-faible', rembourse: 'badge-info', echoue: 'badge-rupture' };

export default function AdminCommandes() {
  const appeler = useApi();
  const { t } = useT();
  const [commandes, setCommandes] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filtre, setFiltre] = useState('');
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [ouverte, setOuverte] = useState(null); // commande dont le détail est affiché
  const [details, setDetails] = useState({}); // détails déjà chargés

  // Recharge la liste à chaque changement de filtre ou de page (GET /api/commandes?statut=...&page=...)
  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur('');
    const params = new URLSearchParams({ page, limit: PAR_PAGE });
    if (filtre) params.set('statut', filtre);
    appeler(`/api/commandes?${params}`)
      .then((reponse) => {
        if (annule) return;
        setCommandes(reponse.data);
        setPagination(reponse.pagination);
      })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [appeler, filtre, page]);

  async function changerStatut(commande, statut) {
    setErreur('');
    setSucces('');
    try {
      await appeler(`/api/commandes/${commande.id}/statut`, { method: 'PATCH', body: { statut } });
      setCommandes((courant) => courant.map((c) => (c.id === commande.id ? { ...c, statut, statut_paiement: statut === 'livree' && c.mode_paiement === 'livraison' ? 'paye' : c.statut_paiement } : c)));
      setSucces(t('commandesAdmin.statutChange', { id: commande.id, statut: t(`statut.${statut}`) }));
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  async function annuler(commande) {
    if (!window.confirm(t('commandesAdmin.confirmerAnnuler', { id: commande.id }))) return;
    setErreur('');
    setSucces('');
    try {
      await appeler(`/api/commandes/${commande.id}/annuler`, { method: 'PATCH' });
      setCommandes((courant) => courant.map((c) => (c.id === commande.id ? { ...c, statut: 'annulee', statut_paiement: c.statut_paiement === 'paye' ? 'rembourse' : c.statut_paiement } : c)));
      setSucces(t('commandesAdmin.annulee', { id: commande.id }));
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
        <h1>{t('commandesAdmin.titre')}</h1>
        <div className="actions-ligne">
        <BoutonExport ressource="commandes" />
        <select
          value={filtre}
          onChange={(e) => { setFiltre(e.target.value); setPage(1); }}
          aria-label={t('commandesAdmin.filtrer')}
        >
          <option value="">{t('commandesAdmin.tousStatuts')}</option>
          {Object.keys(STATUTS).map((cle) => (
            <option key={cle} value={cle}>{t(`statut.${cle}`)}</option>
          ))}
        </select>
        </div>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {succes && <p className="succes">{succes}</p>}
      {chargement && !erreur && <p className="muted">{t('commun.chargement')}</p>}

      {!chargement && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('commun.numero')}</th>
                <th>{t('commandesAdmin.client')}</th>
                <th>{t('commun.date')}</th>
                <th>{t('commun.total')}</th>
                <th>{t('paiement.colonne')}</th>
                <th>{t('commun.statut')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {commandes.length === 0 && (
                <tr><td colSpan="7" className="muted">{t('commandesAdmin.aucune')}</td></tr>
              )}
              {commandes.map((c) => {
                const classe = STATUTS[c.statut]?.classe || '';
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
                        <span className={`badge ${CLASSES_PAIEMENT[c.statut_paiement] || ''}`}>{t(`paiement.statut.${c.statut_paiement}`)}</span>
                        <div className="muted petit">{c.mode_paiement === 'carte' ? `${c.paiement_marque || ''} •••• ${c.paiement_last4 || ''}` : t('paiement.livraison')}</div>
                      </td>
                      <td>
                        {c.statut === 'annulee' ? (
                          <span className={`badge ${classe}`}>{t('statut.annulee')}</span>
                        ) : (
                          <select
                            value={c.statut}
                            aria-label={t('commandesAdmin.statutDe', { id: c.id })}
                            onChange={(e) => changerStatut(c, e.target.value)}
                          >
                            {STATUTS_CHOISISSABLES.map((cle) => (
                              <option key={cle} value={cle}>{t(`statut.${cle}`)}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <div className="actions-ligne">
                          <button className="btn btn-light btn-small" onClick={() => basculerDetail(c.id)}>
                            {ouverte === c.id ? t('commun.masquer') : t('commun.detail')}
                          </button>
                          {c.statut !== 'annulee' && <BoutonFacture commandeId={c.id} />}
                          {annulable && (
                            <button className="btn btn-light btn-small btn-danger" onClick={() => annuler(c)}>{t('commun.annuler')}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {ouverte === c.id && (
                      <tr className="ligne-detail">
                        <td colSpan="7">
                          {!detail ? (
                            <span className="muted">{t('commun.chargementDetail')}</span>
                          ) : (
                            <table className="commande-lignes">
                              <thead>
                                <tr><th>{t('commun.produit')}</th><th>{t('commun.quantite')}</th><th>{t('commun.prixUnitaire')}</th><th>{t('commun.sousTotal')}</th></tr>
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

      <Pagination pagination={pagination} onChange={setPage} />
    </>
  );
}
