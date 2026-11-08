import { useEffect, useState } from 'react';
import { useApi } from '../../useApi.js';

// Gestion des catégories : ajout, modification, suppression
export default function AdminCategories() {
  const appeler = useApi();
  const [categories, setCategories] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [nouvelle, setNouvelle] = useState({ nom: '', description: '' });
  const [edition, setEdition] = useState(null); // { id, nom, description } de la ligne en cours de modification

  useEffect(() => {
    let annule = false;
    appeler('/api/categories')
      .then((data) => { if (!annule) setCategories(data); })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [appeler]);

  async function ajouter(e) {
    e.preventDefault();
    setErreur('');
    setSucces('');
    try {
      const creee = await appeler('/api/categories', { method: 'POST', body: nouvelle });
      setCategories((courant) => [...courant, creee].sort((a, b) => a.nom.localeCompare(b.nom)));
      setNouvelle({ nom: '', description: '' });
      setSucces(`Catégorie "${creee.nom}" ajoutée.`);
    } catch (err) {
      if (err.status !== 401) setErreur(err.message); // ex : "Cette catégorie existe déjà"
    }
  }

  async function enregistrer() {
    setErreur('');
    setSucces('');
    try {
      const maj = await appeler(`/api/categories/${edition.id}`, {
        method: 'PUT',
        body: { nom: edition.nom, description: edition.description },
      });
      setCategories((courant) => courant.map((c) => (c.id === maj.id ? maj : c)));
      setEdition(null);
      setSucces(`Catégorie "${maj.nom}" modifiée.`);
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  async function supprimer(categorie) {
    setErreur('');
    setSucces('');
    try {
      // On compte les produits touchés pour prévenir l'admin avant de supprimer
      const produits = await appeler('/api/produits');
      const nb = produits.filter((p) => p.category_id === categorie.id).length;
      const avertissement = nb > 0
        ? `${nb} produit(s) de cette catégorie seront conservés mais passeront en "Sans catégorie".`
        : 'Aucun produit n\'utilise cette catégorie.';
      if (!window.confirm(`Supprimer la catégorie "${categorie.nom}" ?\n\n${avertissement}`)) return;
      await appeler(`/api/categories/${categorie.id}`, { method: 'DELETE' });
      setCategories((courant) => courant.filter((c) => c.id !== categorie.id));
      setSucces(`Catégorie "${categorie.nom}" supprimée.`);
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  return (
    <>
      <h1>Catégories</h1>

      <form className="card ajout-categorie" onSubmit={ajouter}>
        <label>
          Nom
          <input value={nouvelle.nom} onChange={(e) => setNouvelle({ ...nouvelle, nom: e.target.value })} required />
        </label>
        <label>
          Description
          <input value={nouvelle.description} onChange={(e) => setNouvelle({ ...nouvelle, description: e.target.value })} />
        </label>
        <button className="btn">Ajouter</button>
      </form>

      {erreur && <p className="erreur section-espace">{erreur}</p>}
      {succes && <p className="succes section-espace">{succes}</p>}
      {chargement && !erreur && <p className="muted">Chargement...</p>}

      {!chargement && (
        <div className="card table-wrap section-espace">
          <table>
            <thead>
              <tr><th>Nom</th><th>Description</th><th></th></tr>
            </thead>
            <tbody>
              {categories.length === 0 && (
                <tr><td colSpan="3" className="muted">Aucune catégorie.</td></tr>
              )}
              {categories.map((c) =>
                edition?.id === c.id ? (
                  <tr key={c.id}>
                    <td>
                      <input
                        aria-label="Nom de la catégorie"
                        value={edition.nom}
                        onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        aria-label="Description de la catégorie"
                        value={edition.description || ''}
                        onChange={(e) => setEdition({ ...edition, description: e.target.value })}
                      />
                    </td>
                    <td>
                      <div className="actions-ligne">
                        <button className="btn btn-small" onClick={enregistrer}>Enregistrer</button>
                        <button className="btn btn-light btn-small" onClick={() => setEdition(null)}>Annuler</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id}>
                    <td><strong>{c.nom}</strong></td>
                    <td>{c.description || <span className="muted">—</span>}</td>
                    <td>
                      <div className="actions-ligne">
                        <button className="btn btn-light btn-small" onClick={() => setEdition({ ...c })}>Modifier</button>
                        <button className="btn btn-light btn-small btn-danger" onClick={() => supprimer(c)}>Supprimer</button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
