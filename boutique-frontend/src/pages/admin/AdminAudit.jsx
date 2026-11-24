import { Fragment, useEffect, useState } from 'react';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import BoutonExport from '../../components/BoutonExport.jsx';
import Pagination from '../../components/Pagination.jsx';
import { SkeletonTableau } from '../../components/Skeleton.jsx';
import { formaterDate } from '../../utils.js';
import { useDebounce } from '../../useDebounce.js';

const ENTITES = ['produit', 'categorie', 'commande', 'code_promo', 'fournisseur', 'achat', 'cle_api', 'webhook', 'email', 'avis', 'utilisateur'];
const CLASSES = { creer: 'badge-ok', modifier: 'badge-info', supprimer: 'badge-rupture', annuler: 'badge-rupture', connexion_echec: 'badge-rupture' };

// Journal d'audit : qui a fait quoi, quand (réservé à l'admin)
export default function AdminAudit() {
  const appeler = useApi();
  const { t } = useT();
  const [lignes, setLignes] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [entite, setEntite] = useState('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [recherche, setRecherche] = useState('');
  const rechercheDiff = useDebounce(recherche, 350);
  const [ouvert, setOuvert] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let annule = false;
    setChargement(true);
    const p = new URLSearchParams({ page, limit: 15 });
    if (entite) p.set('entite', entite);
    if (du) p.set('du', du);
    if (au) p.set('au', au);
    if (rechercheDiff.trim()) p.set('search', rechercheDiff.trim());
    appeler(`/api/audit?${p}`)
      .then((r) => { if (!annule) { setLignes(r.data); setPagination(r.pagination); setErreur(''); } })
      .catch((e) => { if (!annule && e.status !== 401) setErreur(e.message); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [appeler, page, entite, du, au, rechercheDiff]);

  const filtre = (setter) => (e) => { setter(e.target.value); setPage(1); };

  return (
    <>
      <div className="entete-section">
        <div>
          <h1>{t('audit.titre')}</h1>
          <p className="muted petit">{t('audit.aide')}</p>
        </div>
        <BoutonExport ressource="audit" />
      </div>

      <div className="filtres-ligne">
        <input type="search" value={recherche} onChange={filtre(setRecherche)} placeholder={t('audit.rechercher')} aria-label={t('audit.rechercher')} />
        <select value={entite} onChange={filtre(setEntite)} aria-label={t('audit.entite')}>
          <option value="">{t('audit.toutes')}</option>
          {ENTITES.map((e) => <option key={e} value={e}>{t(`audit.e.${e}`)}</option>)}
        </select>
        <label className="petit">{t('audit.du')} <input type="date" value={du} onChange={filtre(setDu)} /></label>
        <label className="petit">{t('audit.au')} <input type="date" value={au} onChange={filtre(setAu)} /></label>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {chargement && lignes.length === 0 ? <SkeletonTableau colonnes={5} /> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>{t('commun.date')}</th><th>{t('audit.acteur')}</th><th>{t('audit.action')}</th><th>{t('audit.entite')}</th><th></th></tr></thead>
            <tbody>
              {lignes.length === 0 && <tr><td colSpan="5" className="muted">{t('audit.aucun')}</td></tr>}
              {lignes.map((l) => (
                <Fragment key={l.id}>
                  <tr>
                    <td className="nowrap">{formaterDate(l.created_at)}</td>
                    <td>{l.user_nom || <span className="muted">{t('audit.anonyme')}</span>}<div className="muted petit">{l.ip}</div></td>
                    <td><span className={`badge ${CLASSES[l.action] || 'badge-info'}`}>{l.action.replace(/_/g, ' ')}</span></td>
                    <td>{t(`audit.e.${l.entite}`) === `audit.e.${l.entite}` ? l.entite : t(`audit.e.${l.entite}`)}{l.entite_id ? ` #${l.entite_id}` : ''}</td>
                    <td>{l.details && <button className="btn btn-light btn-small" onClick={() => setOuvert(ouvert === l.id ? null : l.id)}>{ouvert === l.id ? t('commun.masquer') : t('commun.detail')}</button>}</td>
                  </tr>
                  {ouvert === l.id && <tr className="ligne-detail"><td colSpan="5"><pre className="json">{JSON.stringify(l.details, null, 2)}</pre></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={pagination} onChange={setPage} />
    </>
  );
}
