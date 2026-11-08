import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useCart } from '../CartContext.jsx';
import { api } from '../api.js';
import { formaterPrix } from '../utils.js';

export default function Panier() {
  const { items, changerQuantite, retirer, vider, total } = useCart();
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [commande, setCommande] = useState(null); // la commande créée (pour l'affichage de confirmation)

  async function valider() {
    setErreur('');

    // 1) Pas connecté : on envoie vers la connexion, puis on revient ici
    if (!user) {
      navigate('/login', { state: { from: '/panier', message: 'Connectez-vous pour valider votre commande.' } });
      return;
    }
    // 2) Le backend refuse les commandes d'un admin : on prévient avant d'appeler l'API
    if (user.role === 'admin') {
      setErreur("Un compte administrateur ne peut pas passer de commande. Connectez-vous avec un compte client.");
      return;
    }

    // 3) On envoie la commande au backend
    setEnvoi(true);
    try {
      const donnees = await api('/api/commandes', {
        method: 'POST',
        token,
        body: { produits: items.map((i) => ({ produit_id: i.produit_id, quantite: i.quantite })) },
      });
      setCommande(donnees);
      vider(); // la commande est enregistrée : le panier est vidé
    } catch (err) {
      if (err.status === 401) {
        // Le token JWT a expiré (il est valable 1 jour) : il faut se reconnecter
        logout();
        navigate('/login', { state: { from: '/panier', message: 'Votre session a expiré. Reconnectez-vous.' } });
        return;
      }
      setErreur(err.message); // ex : "Stock insuffisant pour ..."
    } finally {
      setEnvoi(false);
    }
  }

  // Écran de confirmation après une commande réussie
  if (commande) {
    return (
      <div className="card form-card center">
        <h1>Commande enregistrée ✓</h1>
        <p>
          Votre commande <strong>n°{commande.id}</strong> a bien été créée.
        </p>
        <p className="muted">Statut : en attente de confirmation</p>
        <p className="total">Total : {formaterPrix(commande.total)}</p>
        <Link to="/commandes" className="btn btn-block">Voir mes commandes</Link>
        <Link to="/" className="btn btn-light btn-block">Retour au catalogue</Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card center">
        <h1>Votre panier est vide</h1>
        <p><Link to="/">Voir le catalogue</Link></p>
      </div>
    );
  }

  return (
    <>
      <h1>Votre panier</h1>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Prix</th>
              <th>Quantité</th>
              <th>Sous-total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.produit_id}>
                <td>{i.nom}</td>
                <td>{formaterPrix(i.prix)}</td>
                <td>
                  <div className="qte">
                    <button
                      className="btn btn-light btn-small"
                      aria-label={`Diminuer la quantité de ${i.nom}`}
                      onClick={() => changerQuantite(i.produit_id, i.quantite - 1)}
                    >
                      −
                    </button>
                    <span className="qte-valeur">{i.quantite}</span>
                    <button
                      className="btn btn-light btn-small"
                      aria-label={`Augmenter la quantité de ${i.nom}`}
                      disabled={i.quantite >= i.stock}
                      onClick={() => changerQuantite(i.produit_id, i.quantite + 1)}
                    >
                      +
                    </button>
                  </div>
                </td>
                <td>{formaterPrix(i.prix * i.quantite)}</td>
                <td>
                  <button className="btn btn-light btn-small" onClick={() => retirer(i.produit_id)}>Retirer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panier-pied">
        <p className="total">Total : {formaterPrix(total)}</p>
        {erreur && <p className="erreur">{erreur}</p>}
        <div className="panier-actions">
          <button className="btn btn-light" onClick={vider}>Vider le panier</button>
          <button className="btn" onClick={valider} disabled={envoi}>
            {envoi ? 'Envoi...' : 'Valider la commande'}
          </button>
        </div>
      </div>
    </>
  );
}
