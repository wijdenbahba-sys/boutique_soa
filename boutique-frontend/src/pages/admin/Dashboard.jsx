import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../useApi.js';
import { STATUTS, formaterPrix } from '../../utils.js';

// Tableau de bord de l'administrateur : GET /api/stats + GET /api/produits/alertes
export default function Dashboard() {
  const appeler = useApi();
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
  if (!stats) return <p className="muted">Chargement...</p>;

  return (
    <>
      <h1>Tableau de bord</h1>

      <div className="stats-grille">
        <div className="card stat">
          <span className="stat-label">Produits</span>
          <strong className="stat-valeur">{stats.total_produits}</strong>
        </div>
        <div className={`card stat ${stats.produits_en_alerte > 0 ? 'stat-alerte' : ''}`}>
          <span className="stat-label">Produits en alerte de stock</span>
          <strong className="stat-valeur">{stats.produits_en_alerte}</strong>
        </div>
        <div className="card stat">
          <span className="stat-label">Commandes</span>
          <strong className="stat-valeur">{stats.total_commandes}</strong>
        </div>
        <div className="card stat">
          <span className="stat-label">Chiffre d'affaires</span>
          <strong className="stat-valeur">{formaterPrix(stats.chiffre_affaires)}</strong>
        </div>
      </div>

      <div className="deux-colonnes">
        <section className="card">
          <h2>Commandes par statut</h2>
          {stats.commandes_par_statut.length === 0 ? (
            <p className="muted">Aucune commande pour le moment.</p>
          ) : (
            <table>
              <tbody>
                {stats.commandes_par_statut.map((s) => {
                  const st = STATUTS[s.statut] || { texte: s.statut, classe: '' };
                  return (
                    <tr key={s.statut}>
                      <td><span className={`badge ${st.classe}`}>{st.texte}</span></td>
                      <td className="droite"><strong>{s.nombre}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2>Produits les plus vendus</h2>
          {stats.top_produits.length === 0 ? (
            <p className="muted">Aucune vente pour le moment.</p>
          ) : (
            <table>
              <tbody>
                {stats.top_produits.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nom}</td>
                    <td className="droite"><strong>{p.quantite_vendue}</strong> vendu(s)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card section-espace">
        <div className="entete-section">
          <h2>Alertes de stock</h2>
          <Link to="/admin/produits" className="btn btn-light btn-small">Gérer les produits</Link>
        </div>
        {alertes.length === 0 ? (
          <p className="muted">Tous les stocks sont suffisants.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Produit</th><th>Stock</th><th>Seuil d'alerte</th></tr>
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
