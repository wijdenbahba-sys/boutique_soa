import { Fragment, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import { formaterDate, formaterPrix } from '../../utils.js';

const CLASSES = { commande: 'badge-faible', recu: 'badge-ok', annule: 'badge-rupture' };

// Réapprovisionnement : bons de commande envoyés aux fournisseurs (GET /api/achats)
// Quand un achat est marqué "reçu", le stock des produits augmente automatiquement.
export default function AdminAchats() {
  const appeler = useApi();
  const { t } = useT();
  const location = useLocation();
  const [achats, setAchats] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [filtre, setFiltre] = useState('');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState(location.state?.succes || '');
  const [ouvert, setOuvert] = useState(null);
  const [details, setDetails] = useState({});
  const [recharger, setRecharger] = useState(0);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    appeler(`/api/achats${filtre ? `?statut=${filtre}` : ''}`)
      .then((data) => { if (!annule) setAchats(data); })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [appeler, filtre, recharger]);

  // Les suggestions dépendent du stock : on les recharge aussi après une réception
  useEffect(() => {
    appeler('/api/achats/suggestions').then(setSuggestions).catch(() => {});
  }, [appeler, recharger]);

  async function basculerDetail(id) {
    if (ouvert === id) {
      setOuvert(null);
      return;
    }
    setOuvert(id);
    if (details[id]) return;
    try {
      const data = await appeler(`/api/achats/${id}`);
      setDetails((courant) => ({ ...courant, [id]: data }));
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  async function agir(achat, action, confirmation, messageSucces) {
    if (!window.confirm(confirmation)) return;
    setErreur('');
    setSucces('');
    try {
      await appeler(`/api/achats/${achat.id}/${action}`, { method: 'PATCH' });
      setSucces(messageSucces);
      setDetails((courant) => { const { [achat.id]: _retire, ...reste } = courant; return reste; });
      setRecharger((n) => n + 1);
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  return (
    <>
      <div className="entete-section">
        <h1>{t('achats.titre')}</h1>
        <div className="actions-ligne">
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label={t('commandesAdmin.filtrer')}>
            <option value="">{t('commandesAdmin.tousStatuts')}</option>
            {Object.keys(CLASSES).map((cle) => <option key={cle} value={cle}>{t(`achat.${cle}`)}</option>)}
          </select>
          <Link to="/admin/achats/nouveau" className="btn">{t('achats.nouveau')}</Link>
        </div>
      </div>

      {suggestions.length > 0 && (
        <section className="card stat-alerte section-espace-bas" aria-labelledby="titre-suggestions">
          <div className="entete-section">
            <h2 id="titre-suggestions">{t('achats.suggestions', { n: suggestions.length })}</h2>
            <Link to="/admin/achats/nouveau" state={{ suggestions: true }} className="btn btn-small">{t('achats.preparer')}</Link>
          </div>
          <p className="petit">
            {suggestions.map((s) => `${s.nom} (${s.stock}/${s.seuil_alerte})`).join(' · ')}
          </p>
        </section>
      )}

      {erreur && <p className="erreur">{erreur}</p>}
      {succes && <p className="succes">{succes}</p>}
      {chargement && !erreur && <p className="muted">{t('commun.chargement')}</p>}

      {!chargement && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('commun.numero')}</th>
                <th>{t('achats.fournisseur')}</th>
                <th>{t('commun.date')}</th>
                <th>{t('achats.lignes')}</th>
                <th>{t('commun.total')}</th>
                <th>{t('commun.statut')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {achats.length === 0 && (
                <tr><td colSpan="7" className="muted">{t('achats.aucun')}</td></tr>
              )}
              {achats.map((a) => {
                const detail = details[a.id];
                return (
                  <Fragment key={a.id}>
                    <tr>
                      <td><strong>{a.id}</strong></td>
                      <td>{a.fournisseur_nom}</td>
                      <td>{formaterDate(a.date_achat)}</td>
                      <td>{a.nb_lignes}</td>
                      <td>{formaterPrix(a.total)}</td>
                      <td><span className={`badge ${CLASSES[a.statut]}`}>{t(`achat.${a.statut}`)}</span></td>
                      <td>
                        <div className="actions-ligne">
                          <button className="btn btn-light btn-small" onClick={() => basculerDetail(a.id)}>
                            {ouvert === a.id ? t('commun.masquer') : t('commun.detail')}
                          </button>
                          {a.statut === 'commande' && (
                            <>
                              <button
                                className="btn btn-small"
                                onClick={() => agir(a, 'recevoir', t('achats.confirmerReception', { id: a.id }), t('achats.recu', { id: a.id }))}
                              >
                                {t('achats.marquerRecu')}
                              </button>
                              <button
                                className="btn btn-light btn-small btn-danger"
                                onClick={() => agir(a, 'annuler', t('achats.confirmerAnnulation', { id: a.id }), t('achats.annule', { id: a.id }))}
                              >
                                {t('commun.annuler')}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {ouvert === a.id && (
                      <tr className="ligne-detail">
                        <td colSpan="7">
                          {!detail ? (
                            <span className="muted">{t('commun.chargementDetail')}</span>
                          ) : (
                            <>
                              <table className="commande-lignes">
                                <thead>
                                  <tr><th>{t('commun.produit')}</th><th>{t('commun.quantite')}</th><th>{t('achats.coutUnitaire')}</th><th>{t('commun.sousTotal')}</th></tr>
                                </thead>
                                <tbody>
                                  {detail.lignes.map((l) => (
                                    <tr key={l.id}>
                                      <td>{l.produit_nom}</td>
                                      <td>{l.quantite}</td>
                                      <td>{formaterPrix(l.cout_unitaire)}</td>
                                      <td>{formaterPrix(l.sous_total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {detail.date_reception && (
                                <p className="muted petit">{t('achats.recuLe', { date: formaterDate(detail.date_reception) })}</p>
                              )}
                            </>
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
