import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api.js';
import { STATUTS, formaterDate, formaterPrix } from '../utils.js';

// Page réservée aux clients : historique de leurs commandes
export default function MesCommandes() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [commandes, setCommandes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [ouverte, setOuverte] = useState(null); // id de la commande dont le détail est affiché
  const [details, setDetails] = useState({}); // détails déjà chargés : { idCommande: { lignes: [...] } }

  const estClient = user?.role === 'client';

  // Session expirée (token JWT valable 1 jour) : on se déconnecte et on renvoie vers la connexion
  function sessionExpiree() {
    logout();
    navigate('/login', { state: { from: '/commandes', message: 'Votre session a expiré. Reconnectez-vous.' } });
  }

  // Chargement de la liste au démarrage de la page
  useEffect(() => {
    if (!estClient) return;
    let annule = false;
    api('/api/commandes/mes-commandes', { token })
      .then((data) => { if (!annule) setCommandes(data); })
      .catch((err) => {
        if (annule) return;
        if (err.status === 401) sessionExpiree();
        else setErreur(err.message);
      })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estClient, token]);

  // Afficher / masquer le détail (les lignes sont chargées une seule fois)
  async function basculerDetail(id) {
    if (ouverte === id) {
      setOuverte(null);
      return;
    }
    setOuverte(id);
    if (details[id]) return;
    try {
      const data = await api(`/api/commandes/${id}`, { token });
      setDetails((courant) => ({ ...courant, [id]: data }));
    } catch (err) {
      if (err.status === 401) sessionExpiree();
      else setErreur(err.message);
    }
  }

  async function annuler(id) {
    if (!window.confirm(`Annuler la commande n°${id} ?`)) return;
    setErreur('');
    setSucces('');
    try {
      await api(`/api/commandes/${id}/annuler`, { method: 'PATCH', token });
      // On met à jour la liste localement : pas besoin de tout recharger
      setCommandes((courant) => courant.map((c) => (c.id === id ? { ...c, statut: 'annulee' } : c)));
      setSucces(`La commande n°${id} a été annulée.`);
    } catch (err) {
      if (err.status === 401) sessionExpiree();
      else setErreur(err.message);
    }
  }

  // Pas connecté : retour vers la connexion, puis on revient ici
  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/commandes', message: 'Connectez-vous pour voir vos commandes.' }} />;
  }
  if (!estClient) {
    return (
      <div className="card center">
        <h1>Mes commandes</h1>
        <p className="muted">Cette page est réservée aux comptes clients.</p>
      </div>
    );
  }

  return (
    <>
      <h1>Mes commandes</h1>
      {erreur && <p className="erreur">{erreur}</p>}
      {succes && <p className="succes">{succes}</p>}
      {chargement && !erreur && <p className="muted">Chargement...</p>}
      {!chargement && !erreur && commandes.length === 0 && (
        <div className="card center">
          <p>Vous n'avez pas encore passé de commande.</p>
          <p><Link to="/">Voir le catalogue</Link></p>
        </div>
      )}

      <div className="commandes">
        {commandes.map((c) => {
          const statut = STATUTS[c.statut] || { texte: c.statut, classe: '' };
          const annulable = c.statut === 'en_attente' || c.statut === 'confirmee';
          const detail = details[c.id];
          return (
            <article key={c.id} className="card">
              <div className="commande-tete">
                <h3>Commande n°{c.id}</h3>
                <span className={`badge ${statut.classe}`}>{statut.texte}</span>
                <span className="muted">{formaterDate(c.date_commande)}</span>
                <strong className="commande-total">{formaterPrix(c.total)}</strong>
              </div>

              {ouverte === c.id && (
                <div className="commande-lignes table-wrap">
                  {!detail ? (
                    <p className="muted">Chargement du détail...</p>
                  ) : (
                    <table>
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
                </div>
              )}

              <div className="commande-actions">
                <button className="btn btn-light btn-small" onClick={() => basculerDetail(c.id)}>
                  {ouverte === c.id ? 'Masquer le détail' : 'Voir le détail'}
                </button>
                {annulable && (
                  <button className="btn btn-light btn-small" onClick={() => annuler(c.id)}>Annuler la commande</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
