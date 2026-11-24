import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import { formaterPrix } from '../../utils.js';

const LIGNE_VIDE = { produit_id: '', quantite: '1', cout_unitaire: '' };

// Création d'un bon de commande fournisseur : POST /api/achats
// Le bouton "suggestions" pré-remplit les lignes avec les produits dont le stock est sous le seuil.
export default function AchatForm() {
  const appeler = useApi();
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();

  const [fournisseurs, setFournisseurs] = useState([]);
  const [produits, setProduits] = useState([]);
  const [fournisseurId, setFournisseurId] = useState('');
  const [lignes, setLignes] = useState([{ ...LIGNE_VIDE }]);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    Promise.all([appeler('/api/fournisseurs'), appeler('/api/produits')])
      .then(([f, p]) => {
        if (annule) return;
        setFournisseurs(f);
        setProduits(p);
        if (f.length === 1) setFournisseurId(String(f[0].id));
      })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [appeler]);

  async function chargerSuggestions() {
    setErreur('');
    try {
      const s = await appeler('/api/achats/suggestions');
      if (s.length === 0) {
        setErreur(t('achatForm.aucuneSuggestion'));
        return;
      }
      setLignes(s.map((x) => ({ produit_id: String(x.produit_id), quantite: String(x.quantite_suggeree), cout_unitaire: '' })));
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  // Arrivée depuis l'encart "à réapprovisionner" : on pré-remplit directement
  useEffect(() => {
    if (location.state?.suggestions) chargerSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function modifierLigne(index, nom, valeur) {
    setLignes((courant) => courant.map((l, i) => (i === index ? { ...l, [nom]: valeur } : l)));
  }

  const total = lignes.reduce((somme, l) => somme + (Number(l.quantite) || 0) * (Number(l.cout_unitaire) || 0), 0);

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');

    if (!fournisseurId) return setErreur(t('achatForm.fournisseurRequis'));
    for (const l of lignes) {
      if (!l.produit_id) return setErreur(t('achatForm.produitRequis'));
      if (!Number.isInteger(Number(l.quantite)) || Number(l.quantite) < 1) return setErreur(t('achatForm.quantiteInvalide'));
      if (l.cout_unitaire === '' || Number(l.cout_unitaire) < 0) return setErreur(t('achatForm.coutInvalide'));
    }

    setEnvoi(true);
    try {
      const achat = await appeler('/api/achats', {
        method: 'POST',
        body: {
          fournisseur_id: Number(fournisseurId),
          lignes: lignes.map((l) => ({
            produit_id: Number(l.produit_id),
            quantite: Number(l.quantite),
            cout_unitaire: Number(l.cout_unitaire),
          })),
        },
      });
      navigate('/admin/achats', { state: { succes: t('achatForm.cree', { id: achat.id }) } });
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement) return <p className="muted">{t('commun.chargement')}</p>;

  if (fournisseurs.length === 0) {
    return (
      <div className="card center">
        <h1>{t('achatForm.titre')}</h1>
        <p className="muted">{t('achatForm.aucunFournisseur')}</p>
        <p><Link to="/admin/fournisseurs" className="btn">{t('achatForm.ajouterFournisseur')}</Link></p>
      </div>
    );
  }

  return (
    <div className="card form-large">
      <h1>{t('achatForm.titre')}</h1>
      <form onSubmit={soumettre}>
        <label>
          {t('achats.fournisseur')}
          <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} required>
            <option value="">{t('achatForm.choisir')}</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </label>

        <div className="entete-section">
          <h2>{t('achatForm.produitsCommandes')}</h2>
          <button type="button" className="btn btn-light btn-small" onClick={chargerSuggestions}>{t('achatForm.suggestions')}</button>
        </div>

        <div className="lignes-achat">
          <div className="ligne-achat ligne-achat-entete" aria-hidden="true">
            <span>{t('commun.produit')}</span>
            <span>{t('commun.quantite')}</span>
            <span>{t('achats.coutUnitaire')}</span>
            <span />
          </div>
          {lignes.map((l, i) => (
            <div className="ligne-achat" key={i}>
              <select
                aria-label={t('commun.produit')}
                value={l.produit_id}
                onChange={(e) => modifierLigne(i, 'produit_id', e.target.value)}
              >
                <option value="">{t('achatForm.choisirProduit')}</option>
                {produits.map((p) => <option key={p.id} value={p.id}>{p.nom} ({t('commun.stock')} : {p.stock})</option>)}
              </select>
              <input
                type="number" min="1" step="1" required
                aria-label={t('commun.quantite')}
                placeholder={t('commun.quantite')}
                value={l.quantite}
                onChange={(e) => modifierLigne(i, 'quantite', e.target.value)}
              />
              <input
                type="number" min="0" step="0.01" required
                aria-label={t('achats.coutUnitaire')}
                placeholder={t('achats.coutUnitaire')}
                value={l.cout_unitaire}
                onChange={(e) => modifierLigne(i, 'cout_unitaire', e.target.value)}
              />
              <button
                type="button"
                className="btn btn-light btn-small btn-danger"
                disabled={lignes.length === 1}
                aria-label={t('achatForm.retirerLigne')}
                onClick={() => setLignes((courant) => courant.filter((_, k) => k !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-light btn-small" onClick={() => setLignes((c) => [...c, { ...LIGNE_VIDE }])}>
          {t('achatForm.ajouterLigne')}
        </button>

        <p className="total">{t('commun.total')} : {formaterPrix(total)}</p>
        <p className="muted petit">{t('achatForm.info')}</p>

        {erreur && <p className="erreur">{erreur}</p>}
        <div className="actions-ligne">
          <button className="btn" disabled={envoi}>{envoi ? t('commun.enregistrement') : t('achatForm.creer')}</button>
          <Link to="/admin/achats" className="btn btn-light">{t('commun.annuler')}</Link>
        </div>
      </form>
    </div>
  );
}
