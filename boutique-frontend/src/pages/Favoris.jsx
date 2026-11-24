import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useFavoris } from '../FavorisContext.jsx';
import { api } from '../api.js';
import { useT } from '../i18n.jsx';
import ProduitCard from '../components/ProduitCard.jsx';

export default function Favoris() {
  const { user, token } = useAuth();
  const { ids } = useFavoris();
  const { t } = useT();
  const [produits, setProduits] = useState(null);
  const [erreur, setErreur] = useState('');

  // On recharge la liste quand un cœur est retiré (ids change)
  useEffect(() => {
    if (user?.role !== 'client') return;
    api('/api/favoris', { token })
      .then((r) => setProduits(Array.isArray(r) ? r : r.data || []))
      .catch((err) => setErreur(err.message));
  }, [user, token, ids.length]);

  if (!user) return <Navigate to="/login" replace state={{ from: '/favoris', message: t('favoris.connexionRequise') }} />;
  if (user.role !== 'client') return <div className="card center"><h1>{t('admin.accesRefuse')}</h1></div>;

  return (
    <>
      <h1>{t('favoris.titre')}</h1>
      {erreur && <p className="erreur">{erreur}</p>}
      {produits && produits.length === 0 && (
        <div className="card center">
          <p>{t('favoris.vide')}</p>
          <Link to="/" className="btn">{t('panier.voirCatalogue')}</Link>
        </div>
      )}
      <div className="grille">
        {(produits || []).map((p) => <ProduitCard key={p.id} produit={p} />)}
      </div>
    </>
  );
}
