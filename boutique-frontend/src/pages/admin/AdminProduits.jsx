import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApi } from '../../useApi.js';
import { formaterPrix } from '../../utils.js';

// Liste des produits côté admin : modifier, supprimer, ajuster le stock
export default function AdminProduits() {
  const appeler = useApi();
  const location = useLocation();
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState(location.state?.succes || ''); // message venant du formulaire
  const [recherche, setRecherche] = useState('');
  const [seulementAlertes, setSeulementAlertes] = useState(false);
  const [ajustements, setAjustements] = useState({}); // valeur saisie pour chaque produit : { idProduit: "10" }

  useEffect(() => {
    let annule = false;
    appeler('/api/produits')
      .then((data) => { if (!annule) setProduits(data); })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [appeler]);

  async function ajusterStock(produit) {
    setErreur('');
    setSucces('');
    const valeur = Number(ajustements[produit.id]);
    if (!Number.isInteger(valeur) || valeur === 0) {
      setErreur('Saisissez un entier différent de 0 (ex : 10 pour ajouter, -3 pour retirer).');
      return;
    }
    try {
      const maj = await appeler(`/api/produits/${produit.id}/stock`, { method: 'PATCH', body: { ajustement: valeur } });
      setProduits((courant) => courant.map((p) => (p.id === produit.id ? { ...p, stock: maj.stock } : p)));
      setAjustements((courant) => ({ ...courant, [produit.id]: '' }));
      setSucces(`Stock de "${produit.nom}" mis à jour : ${maj.stock}.`);
    } catch (err) {
      if (err.status !== 401) setErreur(err.message); // ex : "Le stock ne peut pas devenir négatif"
    }
  }

  async function supprimer(produit) {
    if (!window.confirm(`Supprimer le produit "${produit.nom}" ?`)) return;
    setErreur('');
    setSucces('');
    try {
      await appeler(`/api/produits/${produit.id}`, { method: 'DELETE' });
      setProduits((courant) => courant.filter((p) => p.id !== produit.id));
      setSucces(`Le produit "${produit.nom}" a été supprimé.`);
    } catch (err) {
      if (err.status !== 401) setErreur(err.message); // ex : produit présent dans des commandes (409)
    }
  }

  const affiches = produits.filter((p) => {
    if (seulementAlertes && p.stock > p.seuil_alerte) return false;
    if (recherche && !p.nom.toLowerCase().includes(recherche.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="entete-section">
        <h1>Produits</h1>
        <Link to="/admin/produits/nouveau" className="btn">Ajouter un produit</Link>
      </div>

      <div className="filtres">
        <input
          type="search"
          placeholder="Rechercher un produit..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <label className="case">
          <input type="checkbox" checked={seulementAlertes} onChange={(e) => setSeulementAlertes(e.target.checked)} />
          Stock faible uniquement
        </label>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {succes && <p className="succes">{succes}</p>}
      {chargement && !erreur && <p className="muted">Chargement...</p>}

      {!chargement && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Prix</th>
                <th>Stock</th>
                <th>Ajuster le stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {affiches.length === 0 && (
                <tr><td colSpan="6" className="muted">Aucun produit.</td></tr>
              )}
              {affiches.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nom}</strong></td>
                  <td>{p.categorie_nom || <span className="muted">Sans catégorie</span>}</td>
                  <td>{formaterPrix(p.prix)}</td>
                  <td>
                    <span className={`badge ${p.stock <= 0 ? 'badge-rupture' : p.stock <= p.seuil_alerte ? 'badge-faible' : 'badge-ok'}`}>
                      {p.stock}
                    </span>
                    <span className="muted petit"> / seuil {p.seuil_alerte}</span>
                  </td>
                  <td>
                    <div className="stock-form">
                      <input
                        type="number"
                        step="1"
                        placeholder="+10 / -3"
                        aria-label={`Ajustement du stock de ${p.nom}`}
                        value={ajustements[p.id] ?? ''}
                        onChange={(e) => setAjustements((c) => ({ ...c, [p.id]: e.target.value }))}
                      />
                      <button className="btn btn-light btn-small" onClick={() => ajusterStock(p)}>Appliquer</button>
                    </div>
                  </td>
                  <td>
                    <div className="actions-ligne">
                      <Link to={`/admin/produits/${p.id}`} className="btn btn-light btn-small">Modifier</Link>
                      <button className="btn btn-light btn-small btn-danger" onClick={() => supprimer(p)}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
