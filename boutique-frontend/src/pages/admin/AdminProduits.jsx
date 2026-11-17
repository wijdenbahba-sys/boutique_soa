import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApi } from '../../useApi.js';
import { useDebounce } from '../../useDebounce.js';
import { useT } from '../../i18n.jsx';
import Pagination from '../../components/Pagination.jsx';
import { formaterPrix } from '../../utils.js';

const PAR_PAGE = 10;
const TRIS = {
  nom: { tri: 'nom', ordre: 'asc' },
  prix_asc: { tri: 'prix', ordre: 'asc' },
  prix_desc: { tri: 'prix', ordre: 'desc' },
  stock_asc: { tri: 'stock', ordre: 'asc' },
  recent: { tri: 'date', ordre: 'desc' },
};

// Liste des produits côté admin : recherche, tri et pagination faits par l'API
export default function AdminProduits() {
  const appeler = useApi();
  const { t } = useT();
  const location = useLocation();
  const [produits, setProduits] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState(location.state?.succes || ''); // message venant du formulaire
  const [recherche, setRecherche] = useState('');
  const rechercheEnvoyee = useDebounce(recherche.trim());
  const [seulementAlertes, setSeulementAlertes] = useState(false);
  const [tri, setTri] = useState('nom');
  const [page, setPage] = useState(1);
  const [recharger, setRecharger] = useState(0); // incrémenté pour relancer le chargement
  const [ajustements, setAjustements] = useState({}); // valeur saisie pour chaque produit : { idProduit: "10" }
  const [motifs, setMotifs] = useState({}); // motif saisi pour chaque produit

  useEffect(() => {
    setPage(1);
  }, [rechercheEnvoyee]);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    const params = new URLSearchParams({ page, limit: PAR_PAGE, ...TRIS[tri] });
    if (rechercheEnvoyee) params.set('search', rechercheEnvoyee);
    if (seulementAlertes) params.set('alerte', 'true');

    appeler(`/api/produits?${params}`)
      .then((reponse) => {
        if (annule) return;
        // Page vide après une suppression : on recule d'une page
        if (reponse.data.length === 0 && reponse.pagination.page > 1) {
          setPage(reponse.pagination.pages);
          return;
        }
        setProduits(reponse.data);
        setPagination(reponse.pagination);
      })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [appeler, rechercheEnvoyee, seulementAlertes, tri, page, recharger]);

  async function ajusterStock(produit) {
    setErreur('');
    setSucces('');
    const valeur = Number(ajustements[produit.id]);
    if (!Number.isInteger(valeur) || valeur === 0) {
      setErreur(t('produits.ajustementInvalide'));
      return;
    }
    try {
      const maj = await appeler(`/api/produits/${produit.id}/stock`, {
        method: 'PATCH',
        body: { ajustement: valeur, motif: motifs[produit.id] || undefined },
      });
      setProduits((courant) => courant.map((p) => (p.id === produit.id ? { ...p, stock: maj.stock } : p)));
      setAjustements((courant) => ({ ...courant, [produit.id]: '' }));
      setMotifs((courant) => ({ ...courant, [produit.id]: '' }));
      setSucces(t('produits.stockMisAJour', { nom: produit.nom, stock: maj.stock }));
    } catch (err) {
      if (err.status !== 401) setErreur(err.message); // ex : "Le stock ne peut pas devenir négatif"
    }
  }

  async function supprimer(produit) {
    if (!window.confirm(t('produits.confirmerSuppression', { nom: produit.nom }))) return;
    setErreur('');
    setSucces('');
    try {
      await appeler(`/api/produits/${produit.id}`, { method: 'DELETE' });
      setSucces(t('produits.supprime', { nom: produit.nom }));
      setRecharger((n) => n + 1);
    } catch (err) {
      if (err.status !== 401) setErreur(err.message); // ex : produit présent dans des commandes (409)
    }
  }

  return (
    <>
      <div className="entete-section">
        <h1>{t('produits.titre')}</h1>
        <Link to="/admin/produits/nouveau" className="btn">{t('produits.ajouter')}</Link>
      </div>

      <div className="filtres">
        <input
          type="search"
          placeholder={t('produits.rechercher')}
          aria-label={t('produits.rechercher')}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <select value={tri} aria-label={t('catalogue.trier')} onChange={(e) => { setTri(e.target.value); setPage(1); }}>
          <option value="nom">{t('catalogue.tri.nom')}</option>
          <option value="prix_asc">{t('catalogue.tri.prixAsc')}</option>
          <option value="prix_desc">{t('catalogue.tri.prixDesc')}</option>
          <option value="stock_asc">{t('produits.tri.stockAsc')}</option>
          <option value="recent">{t('catalogue.tri.recent')}</option>
        </select>
        <label className="case">
          <input
            type="checkbox"
            checked={seulementAlertes}
            onChange={(e) => { setSeulementAlertes(e.target.checked); setPage(1); }}
          />
          {t('produits.stockFaibleSeulement')}
        </label>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {succes && <p className="succes">{succes}</p>}
      {chargement && !erreur && <p className="muted">{t('commun.chargement')}</p>}

      {!chargement && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('commun.produit')}</th>
                <th>{t('commun.categorie')}</th>
                <th>{t('commun.prix')}</th>
                <th>{t('commun.stock')}</th>
                <th>{t('produits.ajusterStock')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {produits.length === 0 && (
                <tr><td colSpan="6" className="muted">{t('produits.aucun')}</td></tr>
              )}
              {produits.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nom}</strong></td>
                  <td>{p.categorie_nom || <span className="muted">{t('produit.sansCategorie')}</span>}</td>
                  <td>{formaterPrix(p.prix)}</td>
                  <td>
                    <span className={`badge ${p.stock <= 0 ? 'badge-rupture' : p.stock <= p.seuil_alerte ? 'badge-faible' : 'badge-ok'}`}>
                      {p.stock}
                    </span>
                    <span className="muted petit"> / {t('produits.seuil', { n: p.seuil_alerte })}</span>
                  </td>
                  <td>
                    <div className="stock-form">
                      <input
                        type="number"
                        step="1"
                        placeholder="+10 / -3"
                        aria-label={t('produits.ajustementDe', { nom: p.nom })}
                        value={ajustements[p.id] ?? ''}
                        onChange={(e) => setAjustements((c) => ({ ...c, [p.id]: e.target.value }))}
                      />
                      <input
                        type="text"
                        className="champ-motif"
                        placeholder={t('produits.motif')}
                        aria-label={t('produits.motifDe', { nom: p.nom })}
                        maxLength={255}
                        value={motifs[p.id] ?? ''}
                        onChange={(e) => setMotifs((c) => ({ ...c, [p.id]: e.target.value }))}
                      />
                      <button className="btn btn-light btn-small" onClick={() => ajusterStock(p)}>{t('produits.appliquer')}</button>
                    </div>
                  </td>
                  <td>
                    <div className="actions-ligne">
                      <Link to={`/admin/produits/${p.id}`} className="btn btn-light btn-small">{t('commun.modifier')}</Link>
                      <button className="btn btn-light btn-small btn-danger" onClick={() => supprimer(p)}>{t('commun.supprimer')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} onChange={setPage} />
    </>
  );
}
