import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import ChartVentes from '../../components/ChartVentes.jsx';
import ChartCategories from '../../components/ChartCategories.jsx';
import { STATUTS, formaterPrix } from '../../utils.js';

// Tableau de bord de l'administrateur : GET /api/stats + GET /api/produits/alertes + graphiques
export default function Dashboard() {
  const appeler = useApi();
  const { t } = useT();
  const [stats, setStats] = useState(null);
  const [alertes, setAlertes] = useState([]);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let annule = false;
    Promise.all([appeler('/api/stats'), appeler('/api/produits/alertes')])
      .then(([s, a]) => {
        if (annule) return;
        setStats(s);
        setAlertes(a);
      })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); });
    return () => { annule = true; };
  }, [appeler]);

  if (erreur) return <p className="erreur">{erreur}</p>;
  if (!stats) return <p className="muted">{t('commun.chargement')}</p>;

  return (
    <>
      <h1>{t('dashboard.titre')}</h1>

      <div className="stats-grille">
        <div className="card stat">
          <span className="stat-label">{t('dashboard.produits')}</span>
          <strong className="stat-valeur">{stats.total_produits}</strong>
        </div>
        <div className={`card stat ${stats.produits_en_alerte > 0 ? 'stat-alerte' : ''}`}>
          <span className="stat-label">{t('dashboard.alertes')}</span>
          <strong className="stat-valeur">{stats.produits_en_alerte}</strong>
        </div>
        <div className="card stat">
          <span className="stat-label">{t('dashboard.commandes')}</span>
          <strong className="stat-valeur">{stats.total_commandes}</strong>
        </div>
        <div className="card stat">
          <span className="stat-label">{t('dashboard.chiffreAffaires')}</span>
          <strong className="stat-valeur">{formaterPrix(stats.chiffre_affaires)}</strong>
        </div>
        <div className="card stat">
          <span className="stat-label">{t('dashboard.valeurStock')}</span>
          <strong className="stat-valeur">{formaterPrix(stats.valeur_stock)}</strong>
        </div>
        <Link to="/admin/achats" className="card stat stat-lien">
          <span className="stat-label">{t('dashboard.achatsEnCours')}</span>
          <strong className="stat-valeur">{stats.achats_en_cours}</strong>
        </Link>
      </div>

      <ChartVentes />

      <div className="deux-colonnes section-espace">
        <ChartCategories />

        <section className="card">
          <h2>{t('dashboard.topProduits')}</h2>
          {stats.top_produits.length === 0 ? (
            <p className="muted">{t('dashboard.aucuneVente')}</p>
          ) : (
            <table>
              <tbody>
                {stats.top_produits.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nom}</td>
                    <td className="droite">{t('dashboard.vendus', { n: p.quantite_vendue })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="section-espace">{t('dashboard.parStatut')}</h2>
          {stats.commandes_par_statut.length === 0 ? (
            <p className="muted">{t('dashboard.aucuneCommande')}</p>
          ) : (
            <table>
              <tbody>
                {stats.commandes_par_statut.map((s) => (
                  <tr key={s.statut}>
                    <td><span className={`badge ${STATUTS[s.statut]?.classe || ''}`}>{t(`statut.${s.statut}`)}</span></td>
                    <td className="droite"><strong>{s.nombre}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card section-espace">
        <div className="entete-section">
          <h2>{t('dashboard.alertesStock')}</h2>
          <div className="actions-ligne">
            <Link to="/admin/achats" className="btn btn-light btn-small">{t('dashboard.reapprovisionner')}</Link>
            <Link to="/admin/produits" className="btn btn-light btn-small">{t('dashboard.gererProduits')}</Link>
          </div>
        </div>
        {alertes.length === 0 ? (
          <p className="muted">{t('dashboard.stocksOk')}</p>
        ) : (
          <table>
            <thead>
              <tr><th>{t('commun.produit')}</th><th>{t('commun.stock')}</th><th>{t('commun.seuil')}</th></tr>
            </thead>
            <tbody>
              {alertes.map((p) => (
                <tr key={p.id}>
                  <td>{p.nom}</td>
                  <td><span className={`badge ${p.stock <= 0 ? 'badge-rupture' : 'badge-faible'}`}>{p.stock}</span></td>
                  <td>{p.seuil_alerte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
