import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { useCart } from '../CartContext.jsx';
import { formaterPrix } from '../utils.js';

function etatStock(produit) {
  if (produit.stock <= 0) return { texte: 'Rupture de stock', classe: 'badge-rupture' };
  if (produit.stock <= produit.seuil_alerte) return { texte: `Plus que ${produit.stock} en stock`, classe: 'badge-faible' };
  return { texte: 'En stock', classe: 'badge-ok' };
}

// Affiche un produit (une "carte" du catalogue)
export default function ProduitCard({ produit }) {
  const { user } = useAuth();
  const { items, ajouter } = useCart();
  const [ajoute, setAjoute] = useState(false);

  const stock = etatStock(produit);
  const dansLePanier = items.find((i) => i.produit_id === produit.id)?.quantite || 0;
  const rupture = produit.stock <= 0;
  const stockAtteint = dansLePanier >= produit.stock; // tout le stock est déjà dans le panier

  function clic() {
    ajouter(produit);
    setAjoute(true);
    setTimeout(() => setAjoute(false), 1200); // le message "Ajouté" disparaît après 1,2 s
  }

  let texteBouton = 'Ajouter au panier';
  if (rupture) texteBouton = 'Indisponible';
  else if (stockAtteint) texteBouton = 'Stock maximum atteint';
  else if (ajoute) texteBouton = 'Ajouté ✓';

  return (
    <article className="card produit">
      <div className="produit-image">
        {produit.image_url ? (
          <img src={produit.image_url} alt={produit.nom} />
        ) : (
          <span>{produit.nom.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="produit-corps">
        <span className="produit-categorie">{produit.categorie_nom || 'Sans catégorie'}</span>
        <h3>{produit.nom}</h3>
        {produit.description && <p className="muted">{produit.description}</p>}
        <div className="produit-pied">
          <strong className="prix">{formaterPrix(produit.prix)}</strong>
          <span className={`badge ${stock.classe}`}>{stock.texte}</span>
        </div>
        {/* L'admin ne passe pas de commandes : pas de bouton pour lui */}
        {user?.role !== 'admin' && (
          <button className="btn btn-block" disabled={rupture || stockAtteint} onClick={clic}>
            {texteBouton}
          </button>
        )}
      </div>
    </article>
  );
}
