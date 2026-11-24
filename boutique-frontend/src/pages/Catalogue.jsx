import { SkeletonCartes } from '../components/Skeleton.jsx';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Pagination from '../components/Pagination.jsx';
import ProduitCard from '../components/ProduitCard.jsx';
import { useDebounce } from '../useDebounce.js';
import { useT } from '../i18n.jsx';
import Icone from '../icons.jsx';

const PAR_PAGE = 12;

// Choix de tri proposés : chaque option correspond à ?tri=...&ordre=... côté API
const TRIS = {
  nom: { tri: 'nom', ordre: 'asc' },
  prix_asc: { tri: 'prix', ordre: 'asc' },
  prix_desc: { tri: 'prix', ordre: 'desc' },
  recent: { tri: 'date', ordre: 'desc' },
  note: { tri: 'note', ordre: 'desc' },
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
  const [prixMin, setPrixMin] = useState('');
  const [prixMax, setPrixMax] = useState('');
  const prixMinEnvoye = useDebounce(prixMin);
  const prixMaxEnvoye = useDebounce(prixMax);
  const [enStock, setEnStock] = useState(false);
  const [codeCopie, setCodeCopie] = useState(false);
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
    if (prixMinEnvoye !== '') params.set('prix_min', prixMinEnvoye);
    if (prixMaxEnvoye !== '') params.set('prix_max', prixMaxEnvoye);
    if (enStock) params.set('en_stock', '1');

    api(`/api/produits?${params}`)
      .then((reponse) => {
        if (annule) return;
        setProduits(reponse.data);
        setPagination(reponse.pagination);
      })
      .catch((err) => { if (!annule) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });

    return () => { annule = true; };
  }, [rechercheEnvoyee, categorie, tri, page, prixMinEnvoye, prixMaxEnvoye, enStock]);

  function changerPage(nouvelle) {
    setPage(nouvelle);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const filtresActifs = rechercheEnvoyee || categorie || prixMin !== '' || prixMax !== '' || enStock;

  function copierCode() {
    navigator.clipboard?.writeText('BIENVENUE10').catch(() => {});
    setCodeCopie(true);
    setTimeout(() => setCodeCopie(false), 1500);
  }

  function reinitialiser() {
    setRecherche(''); setCategorie(''); setPrixMin(''); setPrixMax(''); setEnStock(false); setTri('nom'); setPage(1);
  }

  return (
    <>
      {!filtresActifs && page === 1 && (
        <>
          <section className="hero">
            <div>
              <h1>{t('hero.titre')}</h1>
              <p>{t('hero.texte')}</p>
              <div className="hero-actions">
                <a href="#produits" className="btn btn-jasmin">{t('hero.cta')}</a>
              </div>
            </div>
            <div className="hero-promo">
              <small>{t('hero.codeLabel')}</small>
              <strong>BIENVENUE10</strong>
              <button onClick={copierCode}>{codeCopie ? t('hero.copie') : t('hero.copier')}</button>
            </div>
          </section>
          <div className="atouts">
            <div className="atout"><span><Icone nom="camion" /></span><div>{t('atout.livraison')}<small>{t('atout.livraisonTexte')}</small></div></div>
            <div className="atout"><span><Icone nom="bouclier" /></span><div>{t('atout.paiement')}<small>{t('atout.paiementTexte')}</small></div></div>
            <div className="atout"><span><Icone nom="etiquette" /></span><div>{t('atout.promos')}<small>{t('atout.promosTexte')}</small></div></div>
          </div>
        </>
      )}

      <h1 id="produits">{t('catalogue.titre')}</h1>

      <div className="filtres">
        <input
          type="search"
          placeholder={t('catalogue.rechercher')}
          aria-label={t('catalogue.rechercher')}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <select
          value={tri}
          aria-label={t('catalogue.trier')}
          onChange={(e) => { setTri(e.target.value); setPage(1); }}
        >
          <option value="nom">{t('catalogue.tri.nom')}</option>
          <option value="prix_asc">{t('catalogue.tri.prixAsc')}</option>
          <option value="prix_desc">{t('catalogue.tri.prixDesc')}</option>
          <option value="recent">{t('catalogue.tri.recent')}</option>
          <option value="note">{t('catalogue.tri.note')}</option>
        </select>
      </div>

      <div className="chips" role="group" aria-label={t('catalogue.categorie')}>
        <button className="chip" aria-pressed={categorie === ''} onClick={() => { setCategorie(''); setPage(1); }}>
          {t('catalogue.toutesCategories')}
        </button>
        {categories.map((c) => (
          <button key={c.id} className="chip" aria-pressed={String(categorie) === String(c.id)} onClick={() => { setCategorie(String(c.id)); setPage(1); }}>
            {c.nom}
          </button>
        ))}
      </div>

      <div className="filtres-avances">
        <label>
          {t('catalogue.prixMin')}
          <input type="number" min="0" step="1" value={prixMin} onChange={(e) => { setPrixMin(e.target.value); setPage(1); }} />
        </label>
        <label>
          {t('catalogue.prixMax')}
          <input type="number" min="0" step="1" value={prixMax} onChange={(e) => { setPrixMax(e.target.value); setPage(1); }} />
        </label>
        <label className="case">
          <input type="checkbox" checked={enStock} onChange={(e) => { setEnStock(e.target.checked); setPage(1); }} />
          {t('catalogue.enStock')}
        </label>
        {filtresActifs && <button className="btn btn-light btn-small" onClick={reinitialiser}>{t('catalogue.reinitialiser')}</button>}
      </div>
      {pagination && !erreur && <p className="muted petit resultats">{t('catalogue.resultats', { n: pagination.total })}</p>}

      {erreur && <p className="erreur">{erreur}</p>}
      {chargement && !erreur && produits.length === 0 && <SkeletonCartes />}
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
