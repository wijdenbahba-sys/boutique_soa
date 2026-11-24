import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useCart } from '../CartContext.jsx';
import { useFavoris } from '../FavorisContext.jsx';
import { useT } from '../i18n.jsx';
import { imageSrc } from '../api.js';
import { formaterPrix } from '../utils.js';
import Etoiles from './Etoiles.jsx';
import Icone from '../icons.jsx';

export function etatStock(produit, t) {
  if (produit.stock <= 0) return { texte: t('stock.rupture'), classe: 'badge-rupture' };
  if (produit.stock <= produit.seuil_alerte) return { texte: t('stock.faible', { n: produit.stock }), classe: 'badge-faible urgent' };
  return { texte: t('stock.enStock'), classe: 'badge-ok' };
}

// Couleur de la tuile quand le produit n'a pas d'image : dépend de l'id, donc stable
export const teinte = (id) => (Number(id) * 47) % 360;

// Affiche un produit (une "carte" du catalogue)
export default function ProduitCard({ produit }) {
  const { user } = useAuth();
  const { items, ajouter } = useCart();
  const favoris = useFavoris();
  const { t } = useT();
  const navigate = useNavigate();
  const [ajoute, setAjoute] = useState(false);

  const stock = etatStock(produit, t);
  const dansLePanier = items.find((i) => i.produit_id === produit.id)?.quantite || 0;
  const rupture = produit.stock <= 0;
  const stockAtteint = dansLePanier >= produit.stock; // tout le stock est déjà dans le panier
  const src = imageSrc(produit.image_url);
  const estFavori = favoris.estFavori(produit.id);

  function clic() {
    ajouter(produit);
    setAjoute(true);
    setTimeout(() => setAjoute(false), 1200); // le message "Ajouté" disparaît après 1,2 s
  }

  function clicFavori() {
    if (!user) {
      navigate('/login', { state: { from: '/', message: t('favoris.connexionRequise') } });
      return;
    }
    favoris.basculer(produit.id);
  }

  let texteBouton = t('produit.ajouter');
  if (rupture) texteBouton = t('produit.indisponible');
  else if (stockAtteint) texteBouton = t('produit.stockMax');
  else if (ajoute) texteBouton = t('produit.ajoute');

  return (
    <article className="card produit">
      <Link to={`/produit/${produit.id}`} className="produit-image" style={{ '--teinte': teinte(produit.id) }} aria-label={produit.nom}>
        {src ? <img src={src} alt="" loading="lazy" /> : <span>{produit.nom.charAt(0).toUpperCase()}</span>}
      </Link>
      {user?.role !== 'admin' && (
        <button
          className="favori-btn"
          aria-pressed={estFavori}
          aria-label={estFavori ? t('favoris.retirer') : t('favoris.ajouter')}
          onClick={clicFavori}
        >
          <Icone nom="coeur" taille={18} />
        </button>
      )}
      <div className="produit-corps">
        <span className="produit-categorie">{produit.categorie_nom || t('produit.sansCategorie')}</span>
        <h3><Link to={`/produit/${produit.id}`}>{produit.nom}</Link></h3>
        {produit.nb_avis > 0 && <Etoiles note={produit.note_moyenne} nb={produit.nb_avis} />}
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
