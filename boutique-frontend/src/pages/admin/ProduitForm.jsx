import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../useApi.js';

// Formulaire d'ajout (/admin/produits/nouveau) et de modification (/admin/produits/:id)
export default function ProduitForm() {
  const { id } = useParams(); // présent seulement en modification
  const modification = Boolean(id);
  const appeler = useApi();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [champs, setChamps] = useState({
    nom: '', description: '', prix: '', stock: '0', seuil_alerte: '5', image_url: '', category_id: '',
  });
  const [chargement, setChargement] = useState(modification);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let annule = false;
    appeler('/api/categories')
      .then((data) => { if (!annule) setCategories(data); })
      .catch(() => {});
    if (modification) {
      appeler(`/api/produits/${id}`)
        .then((p) => {
          if (annule) return;
          setChamps({
            nom: p.nom,
            description: p.description || '',
            prix: String(p.prix),
            stock: String(p.stock),
            seuil_alerte: String(p.seuil_alerte),
            image_url: p.image_url || '',
            category_id: p.category_id ? String(p.category_id) : '',
          });
        })
        .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); })
        .finally(() => { if (!annule) setChargement(false); });
    }
    return () => { annule = true; };
  }, [appeler, id, modification]);

  function modifier(nom) {
    return (e) => setChamps((c) => ({ ...c, [nom]: e.target.value }));
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');

    // Mêmes règles que le backend
    const prix = Number(champs.prix);
    const stock = Number(champs.stock);
    const seuil = Number(champs.seuil_alerte);
    if (!champs.nom.trim()) return setErreur('Le nom est obligatoire.');
    if (champs.prix === '' || Number.isNaN(prix) || prix < 0) return setErreur('Le prix doit être un nombre supérieur ou égal à 0.');
    if (!Number.isInteger(stock) || stock < 0) return setErreur('Le stock doit être un entier supérieur ou égal à 0.');
    if (!Number.isInteger(seuil) || seuil < 0) return setErreur("Le seuil d'alerte doit être un entier supérieur ou égal à 0.");

    const corps = {
      nom: champs.nom.trim(),
      description: champs.description.trim(),
      prix,
      stock,
      seuil_alerte: seuil,
      image_url: champs.image_url.trim(),
      category_id: champs.category_id ? Number(champs.category_id) : null,
    };

    setEnvoi(true);
    try {
      if (modification) {
        await appeler(`/api/produits/${id}`, { method: 'PUT', body: corps });
      } else {
        await appeler('/api/produits', { method: 'POST', body: corps });
      }
      navigate('/admin/produits', {
        state: { succes: modification ? `Le produit "${corps.nom}" a été modifié.` : `Le produit "${corps.nom}" a été ajouté.` },
      });
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement) return <p className="muted">Chargement...</p>;

  return (
    <div className="card form-large">
      <h1>{modification ? 'Modifier le produit' : 'Ajouter un produit'}</h1>
      <form onSubmit={soumettre}>
        <label>
          Nom
          <input value={champs.nom} onChange={modifier('nom')} required />
        </label>
        <label>
          Description
          <textarea rows="3" value={champs.description} onChange={modifier('description')} />
        </label>
        <div className="form-grille">
          <label>
            Prix (DT)
            <input type="number" step="0.01" min="0" value={champs.prix} onChange={modifier('prix')} required />
          </label>
          <label>
            Catégorie
            <select value={champs.category_id} onChange={modifier('category_id')}>
              <option value="">Aucune</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </label>
          <label>
            Stock
            <input type="number" step="1" min="0" value={champs.stock} onChange={modifier('stock')} required />
          </label>
          <label>
            Seuil d'alerte
            <input type="number" step="1" min="0" value={champs.seuil_alerte} onChange={modifier('seuil_alerte')} required />
          </label>
        </div>
        <label>
          Image (URL, facultatif)
          <input type="url" placeholder="https://..." value={champs.image_url} onChange={modifier('image_url')} />
        </label>

        {erreur && <p className="erreur">{erreur}</p>}
        <div className="actions-ligne">
          <button className="btn" disabled={envoi}>{envoi ? 'Enregistrement...' : 'Enregistrer'}</button>
          <Link to="/admin/produits" className="btn btn-light">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
