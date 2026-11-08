import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ProduitCard from '../components/ProduitCard.jsx';

export default function Catalogue() {
  const [produits, setProduits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [rechercheEnvoyee, setRechercheEnvoyee] = useState(''); // valeur réellement envoyée à l'API
  const [categorie, setCategorie] = useState('');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  // 1) Au chargement de la page : récupérer la liste des catégories (une seule fois)
  useEffect(() => {
    api('/api/categories')
      .then(setCategories)
      .catch(() => {}); // si ça échoue, le filtre est simplement vide
  }, []);

  // 2) Attendre 400 ms après la dernière frappe avant de lancer la recherche
  //    (évite d'appeler l'API à chaque lettre tapée)
  useEffect(() => {
    const minuteur = setTimeout(() => setRechercheEnvoyee(recherche.trim()), 400);
    return () => clearTimeout(minuteur);
  }, [recherche]);

  // 3) Charger les produits à chaque changement de recherche ou de catégorie
  useEffect(() => {
    let annule = false; // ignore une réponse arrivée trop tard (ancienne recherche)
    setChargement(true);
    setErreur('');

    const params = new URLSearchParams();
    if (rechercheEnvoyee) params.set('search', rechercheEnvoyee);
    if (categorie) params.set('categorie', categorie);
    const requete = params.toString();

    api(`/api/produits${requete ? `?${requete}` : ''}`)
      .then((data) => { if (!annule) setProduits(data); })
      .catch((err) => { if (!annule) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });

    return () => { annule = true; };
  }, [rechercheEnvoyee, categorie]);

  return (
    <>
      <h1>Catalogue</h1>

      <div className="filtres">
        <input
          type="search"
          placeholder="Rechercher un produit..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {chargement && !erreur && <p className="muted">Chargement...</p>}
      {!chargement && !erreur && produits.length === 0 && (
        <p className="muted">Aucun produit ne correspond à votre recherche.</p>
      )}

      <div className="grille">
        {produits.map((p) => (
          <ProduitCard key={p.id} produit={p} />
        ))}
      </div>
    </>
  );
}
