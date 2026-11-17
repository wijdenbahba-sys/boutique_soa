import { useEffect, useState } from 'react';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import Pagination from '../../components/Pagination.jsx';
import { formaterDate } from '../../utils.js';

const TYPES = ['initial', 'vente', 'annulation', 'ajustement', 'reception', 'modification'];
const PAR_PAGE = 20;

// Historique complet des mouvements de stock : GET /api/mouvements
export default function AdminMouvements() {
  const appeler = useApi();
  const { t } = useT();
  const [mouvements, setMouvements] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [produits, setProduits] = useState([]);
  const [filtres, setFiltres] = useState({ produit_id: '', type: '', du: '', au: '' });
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  // Liste des produits pour le filtre
  useEffect(() => {
    appeler('/api/produits').then(setProduits).catch(() => {});
  }, [appeler]);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur('');
    const params = new URLSearchParams({ page, limit: PAR_PAGE });
    for (const [cle, valeur] of Object.entries(filtres)) {
      if (valeur) params.set(cle, valeur);
    }
    appeler(`/api/mouvements?${params}`)
      .then((reponse) => {
        if (annule) return;
        setMouvements(reponse.data);
        setPagination(reponse.pagination);
      })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [appeler, filtres, page]);

  function changerFiltre(nom) {
    return (e) => {
      setFiltres((f) => ({ ...f, [nom]: e.target.value }));
      setPage(1);
    };
  }

  const reinitialiser = () => {
    setFiltres({ produit_id: '', type: '', du: '', au: '' });
    setPage(1);
  };
  const filtreActif = Object.values(filtres).some(Boolean);

  return (
    <>
      <h1>{t('mouvements.titre')}</h1>
      <p className="muted">{t('mouvements.intro')}</p>

      <div className="filtres">
        <select value={filtres.produit_id} onChange={changerFiltre('produit_id')} aria-label={t('commun.produit')}>
          <option value="">{t('mouvements.tousProduits')}</option>
          {produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <select value={filtres.type} onChange={changerFiltre('type')} aria-label={t('mouvements.type')}>
          <option value="">{t('mouvements.tousTypes')}</option>
          {TYPES.map((ty) => <option key={ty} value={ty}>{t(`mouvement.${ty}`)}</option>)}
        </select>
        <label className="champ-date">
          {t('mouvements.du')}
          <input type="date" value={filtres.du} onChange={changerFiltre('du')} />
        </label>
        <label className="champ-date">
          {t('mouvements.au')}
          <input type="date" value={filtres.au} onChange={changerFiltre('au')} />
        </label>
        {filtreActif && <button className="btn btn-light" onClick={reinitialiser}>{t('mouvements.reinitialiser')}</button>}
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {chargement && !erreur && <p className="muted">{t('commun.chargement')}</p>}

      {!chargement && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('commun.date')}</th>
                <th>{t('commun.produit')}</th>
                <th>{t('mouvements.type')}</th>
                <th className="droite">{t('mouvements.variation')}</th>
                <th className="droite">{t('mouvements.stockApres')}</th>
                <th>{t('mouvements.motif')}</th>
                <th>{t('mouvements.par')}</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.length === 0 && (
                <tr><td colSpan="7" className="muted">{t('mouvements.aucun')}</td></tr>
              )}
              {mouvements.map((m) => (
                <tr key={m.id}>
                  <td>{formaterDate(m.created_at)}</td>
                  <td><strong>{m.produit_nom}</strong></td>
                  <td><span className="badge badge-info">{t(`mouvement.${m.type}`)}</span></td>
                  {/* Entrée en vert avec +, sortie en rouge avec − : le signe porte aussi l'information (pas seulement la couleur) */}
                  <td className={`droite variation ${m.quantite > 0 ? 'entree' : 'sortie'}`}>
                    <span dir="ltr">{m.quantite > 0 ? `+${m.quantite}` : `−${Math.abs(m.quantite)}`}</span>
                  </td>
                  <td className="droite">{m.stock_apres}</td>
                  <td>{m.motif || <span className="muted">—</span>}</td>
                  <td>{m.utilisateur_nom || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} onChange={setPage} />
    </>
  );
}
