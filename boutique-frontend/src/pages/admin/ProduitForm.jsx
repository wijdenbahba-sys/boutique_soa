import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import { imageSrc } from '../../api.js';

// Formulaire d'ajout (/admin/produits/nouveau) et de modification (/admin/produits/:id)
export default function ProduitForm() {
  const { id } = useParams(); // présent seulement en modification
  const modification = Boolean(id);
  const appeler = useApi();
  const { t } = useT();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [champs, setChamps] = useState({
    nom: '', description: '', prix: '', stock: '0', seuil_alerte: '5', image_url: '', category_id: '',
  });
  const [chargement, setChargement] = useState(modification);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [fichier, setFichier] = useState(null); // image choisie (envoyée après l'enregistrement du produit)
  const [apercu, setApercu] = useState('');
  const [imageSupprimee, setImageSupprimee] = useState(false);

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
    if (!champs.nom.trim()) return setErreur(t('form.nomObligatoire'));
    if (champs.prix === '' || Number.isNaN(prix) || prix < 0) return setErreur(t('form.prixInvalide'));
    if (!Number.isInteger(stock) || stock < 0) return setErreur(t('form.stockInvalide'));
    if (!Number.isInteger(seuil) || seuil < 0) return setErreur(t('form.seuilInvalide'));

    const corps = {
      nom: champs.nom.trim(),
      description: champs.description.trim(),
      prix,
      stock,
      seuil_alerte: seuil,
      category_id: champs.category_id ? Number(champs.category_id) : null,
    };

    setEnvoi(true);
    try {
      let produitId = id;
      if (modification) {
        await appeler(`/api/produits/${id}`, { method: 'PUT', body: corps });
      } else {
        const cree = await appeler('/api/produits', { method: 'POST', body: corps });
        produitId = cree.id;
      }
      // L'image est un fichier : elle part dans une requête séparée (multipart)
      if (fichier) {
        const donnees = new FormData();
        donnees.append('image', fichier);
        await appeler(`/api/produits/${produitId}/image`, { method: 'POST', body: donnees });
      } else if (imageSupprimee) {
        await appeler(`/api/produits/${produitId}/image`, { method: 'DELETE' });
      }
      navigate('/admin/produits', {
        state: { succes: t(modification ? 'form.modifie' : 'form.ajoute', { nom: corps.nom }) },
      });
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement) return <p className="muted">{t('commun.chargement')}</p>;

  return (
    <div className="card form-large">
      <h1>{modification ? t('form.titreModifier') : t('form.titreAjouter')}</h1>
      <form onSubmit={soumettre}>
        <label>
          {t('commun.nom')}
          <input value={champs.nom} onChange={modifier('nom')} required />
        </label>
        <label>
          {t('commun.description')}
          <textarea rows="3" value={champs.description} onChange={modifier('description')} />
        </label>
        <div className="form-grille">
          <label>
            {t('form.prixDt')}
            <input type="number" step="0.01" min="0" value={champs.prix} onChange={modifier('prix')} required />
          </label>
          <label>
            {t('commun.categorie')}
            <select value={champs.category_id} onChange={modifier('category_id')}>
              <option value="">{t('form.aucune')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </label>
          <label>
            {t('commun.stock')}
            <input type="number" step="1" min="0" value={champs.stock} onChange={modifier('stock')} required />
          </label>
          <label>
            {t('form.seuilAlerte')}
            <input type="number" step="1" min="0" value={champs.seuil_alerte} onChange={modifier('seuil_alerte')} required />
          </label>
        </div>
        <div className="upload">
          {(apercu || (champs.image_url && !imageSupprimee)) && (
            <img src={apercu || imageSrc(champs.image_url)} alt={t('form.apercu')} />
          )}
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <label>
              {t('form.image')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f && f.size > 2 * 1024 * 1024) { setErreur(t('form.imageTrop')); e.target.value = ''; return; }
                  setErreur(''); setFichier(f); setImageSupprimee(false);
                  setApercu(f ? URL.createObjectURL(f) : '');
                }}
              />
            </label>
            <span className="muted petit">{t('form.imageAide')}</span>
            {(champs.image_url || apercu) && !imageSupprimee && (
              <button
                type="button"
                className="btn btn-light btn-small btn-danger"
                style={{ justifySelf: 'start' }}
                onClick={() => { setFichier(null); setApercu(''); setImageSupprimee(Boolean(champs.image_url)); }}
              >
                {t('form.retirerImage')}
              </button>
            )}
          </div>
        </div>

        {erreur && <p className="erreur">{erreur}</p>}
        <div className="actions-ligne">
          <button className="btn" disabled={envoi}>{envoi ? t('commun.enregistrement') : t('commun.enregistrer')}</button>
          <Link to="/admin/produits" className="btn btn-light">{t('commun.annuler')}</Link>
        </div>
      </form>
    </div>
  );
}
