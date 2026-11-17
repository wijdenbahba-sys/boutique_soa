import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { useCart } from '../CartContext.jsx';
import { useT } from '../i18n.jsx';
import { formaterPrix } from '../utils.js';

function etatStock(produit, t) {
  if (produit.stock <= 0) return { texte: t('stock.rupture'), classe: 'badge-rupture' };
  if (produit.stock <= produit.seuil_alerte) return { texte: t('stock.faible', { n: produit.stock }), classe: 'badge-faible' };
  return { texte: t('stock.enStock'), classe: 'badge-ok' };
}

// Affiche un produit (une "carte" du catalogue)
export default function ProduitCard({ produit }) {
  const { user } = useAuth();
  const { items, ajouter } = useCart();
  const { t } = useT();
  const [ajoute, setAjoute] = useState(false);

  const stock = etatStock(produit, t);
  const dansLePanier = items.find((i) => i.produit_id === produit.id)?.quantite || 0;
  const rupture = produit.stock <= 0;
  const stockAtteint = dansLePanier >= produit.stock; // tout le stock est déjà dans le panier

  function clic() {
    ajouter(produit);
    setAjoute(true);
    setTimeout(() => setAjoute(false), 1200); // le message "Ajouté" disparaît après 1,2 s
  }

  let texteBouton = t('produit.ajouter');
  if (rupture) texteBouton = t('produit.indisponible');
  else if (stockAtteint) texteBouton = t('produit.stockMax');
  else if (ajoute) texteBouton = t('produit.ajoute');

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
        <span className="produit-categorie">{produit.categorie_nom || t('produit.sansCategorie')}</span>
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
