import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Pagination from '../components/Pagination.jsx';
import ProduitCard from '../components/ProduitCard.jsx';
import { useDebounce } from '../useDebounce.js';
import { useT } from '../i18n.jsx';

const PAR_PAGE = 12;

// Choix de tri proposés : chaque option correspond à ?tri=...&ordre=... côté API
const TRIS = {
  nom: { tri: 'nom', ordre: 'asc' },
  prix_asc: { tri: 'prix', ordre: 'asc' },
  prix_desc: { tri: 'prix', ordre: 'desc' },
  recent: { tri: 'date', ordre: 'desc' },
};

export default function Catalogue() {
  const { t } = useT();
  const [produits, setProduits] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [categories, setCategories] = useState([]);
  const [recherche, setRecherche] = useState('');
  const rechercheEnvoyee = useDebounce(recherche.trim()); // valeur réellement envoyée à l'API
  const [categorie, setCategorie] = useState('');
  const [tri, setTri] = useState('nom');
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  // 1) Au chargement de la page : récupérer la liste des catégories (une seule fois)
  useEffect(() => {
    api('/api/categories')
      .then(setCategories)
      .catch(() => {}); // si ça échoue, le filtre est simplement vide
  }, []);

  // 2) Une nouvelle recherche ramène à la première page
  useEffect(() => {
    setPage(1);
  }, [rechercheEnvoyee]);

  // 3) Charger les produits à chaque changement de recherche, catégorie, tri ou page
  useEffect(() => {
    let annule = false; // ignore une réponse arrivée trop tard (ancienne recherche)
    setChargement(true);
    setErreur('');

    const params = new URLSearchParams({ page, limit: PAR_PAGE, ...TRIS[tri] });
    if (rechercheEnvoyee) params.set('search', rechercheEnvoyee);
    if (categorie) params.set('categorie', categorie);

    api(`/api/produits?${params}`)
      .then((reponse) => {
        if (annule) return;
        setProduits(reponse.data);
        setPagination(reponse.pagination);
      })
      .catch((err) => { if (!annule) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });

    return () => { annule = true; };
  }, [rechercheEnvoyee, categorie, tri, page]);

  function changerPage(nouvelle) {
    setPage(nouvelle);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <h1>{t('catalogue.titre')}</h1>

      <div className="filtres">
        <input
          type="search"
          placeholder={t('catalogue.rechercher')}
          aria-label={t('catalogue.rechercher')}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <select
          value={categorie}
          aria-label={t('catalogue.categorie')}
          onChange={(e) => { setCategorie(e.target.value); setPage(1); }}
        >
          <option value="">{t('catalogue.toutesCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
        <select
          value={tri}
          aria-label={t('catalogue.trier')}
          onChange={(e) => { setTri(e.target.value); setPage(1); }}
        >
          <option value="nom">{t('catalogue.tri.nom')}</option>
          <option value="prix_asc">{t('catalogue.tri.prixAsc')}</option>
          <option value="prix_desc">{t('catalogue.tri.prixDesc')}</option>
          <option value="recent">{t('catalogue.tri.recent')}</option>
        </select>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {chargement && !erreur && <p className="muted">{t('commun.chargement')}</p>}
      {!chargement && !erreur && produits.length === 0 && (
        <p className="muted">{t('catalogue.aucun')}</p>
      )}

      <div className="grille">
        {produits.map((p) => (
          <ProduitCard key={p.id} produit={p} />
        ))}
      </div>

      <Pagination pagination={pagination} onChange={changerPage} />
    </>
  );
}
