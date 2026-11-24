import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import ChartVentes from '../../components/ChartVentes.jsx';
import ChartCategories from '../../components/ChartCategories.jsx';
import Sparkline from '../../components/Sparkline.jsx';
import { SkeletonTableau } from '../../components/Skeleton.jsx';
import { useEvenements, decrire, ICONES_EVENEMENT } from '../../Evenements.jsx';
import Icone from '../../icons.jsx';
import { STATUTS, formaterDate, formaterPrix } from '../../utils.js';

// Tableau de bord de l'administrateur : GET /api/stats + GET /api/produits/alertes + graphiques
export default function Dashboard() {
  const appeler = useApi();
  const { t } = useT();
  const [stats, setStats] = useState(null);
  const [alertes, setAlertes] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [erreur, setErreur] = useState('');
  const { evenements, connecte, abonner } = useEvenements();
  const actif = useRef(true);

  const charger = useCallback(() => {
    return Promise.all([appeler('/api/stats'), appeler('/api/produits/alertes'), appeler('/api/stats/ventes?jours=14')])
      .then(([s, a, v]) => {
        if (!actif.current) return;
        setStats(s);
        setAlertes(a);
        setVentes(v);
      })
      .catch((err) => { if (actif.current && err.status !== 401) setErreur(err.message); });
  }, [appeler]);

  useEffect(() => {
    actif.current = true;
    charger();
    return () => { actif.current = false; };
  }, [charger]);

  // Tableau de bord "en direct" : à chaque événement reçu, les chiffres sont rafraîchis
  useEffect(() => {
    let minuterie;
    const fin = abonner(() => { clearTimeout(minuterie); minuterie = setTimeout(charger, 400); });
    return () => { fin(); clearTimeout(minuterie); };
  }, [abonner, charger]);

  if (erreur) return <p className="erreur">{erreur}</p>;
  if (!stats) return <SkeletonTableau lignes={5} colonnes={4} />;

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
          <Sparkline valeurs={ventes.map((j) => j.commandes)} titre={t('dashboard.tendanceCommandes')} />
        </div>
        <div className="card stat">
          <span className="stat-label">{t('dashboard.chiffreAffaires')}</span>
          <strong className="stat-valeur">{formaterPrix(stats.chiffre_affaires)}</strong>
          <Sparkline valeurs={ventes.map((j) => j.chiffre_affaires)} titre={t('dashboard.tendanceCA')} />
        </div>
        <div className="card stat">
          <span className="stat-label">{t('dashboard.valeurStock')}</span>
          <strong className="stat-valeur">{formaterPrix(stats.valeur_stock)}</strong>
        </div>
        <div className="card stat">
          <span className="stat-label">{t('dashboard.clients')}</span>
          <strong className="stat-valeur">{stats.nb_clients ?? 0}</strong>
        </div>
        <Link to="/admin/achats" className="card stat stat-lien">
          <span className="stat-label">{t('dashboard.achatsEnCours')}</span>
          <strong className="stat-valeur">{stats.achats_en_cours}</strong>
        </Link>
      </div>

      <section className="card section-espace">
        <div className="entete-section">
          <h2>{t('dashboard.activite')}</h2>
          <span className={`badge ${connecte ? 'badge-ok' : 'badge-faible'}`}>
            <span className={`point-live ${connecte ? 'en-ligne' : ''}`} aria-hidden="true" />{connecte ? t('cloche.enDirect') : t('cloche.hors')}
          </span>
        </div>
        {evenements.length === 0 ? (
          <p className="muted">{t('dashboard.activiteVide')}</p>
        ) : (
          <ul className="flux flux-large">
            {evenements.slice(0, 7).map((ev) => (
              <li key={ev.id}>
                <span className={`flux-icone flux-${ev.type.split('.')[0]}`}><Icone nom={ICONES_EVENEMENT[ev.type] || 'cloche'} taille={16} /></span>
                <span>{decrire(ev, t)}</span>
                <span className="muted petit">{formaterDate(ev.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
