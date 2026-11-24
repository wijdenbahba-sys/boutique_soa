import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useCart } from '../CartContext.jsx';
import { useFavoris } from '../FavorisContext.jsx';
import { api, imageSrc } from '../api.js';
import { useT } from '../i18n.jsx';
import { formaterDate, formaterPrix } from '../utils.js';
import Etoiles from '../components/Etoiles.jsx';
import ProduitCard, { etatStock, teinte } from '../components/ProduitCard.jsx';
import Icone from '../icons.jsx';

// Choix de la note (1 à 5 étoiles cliquables)
function ChoixNote({ valeur, onChange, t }) {
  return (
    <div className="choix-note" role="group" aria-label={t('avis.note')}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          className={i <= valeur ? 'actif' : ''}
          aria-pressed={i === valeur}
          aria-label={t('avis.etoiles', { n: i })}
          onClick={() => onChange(i)}
        >
          <Icone nom="etoile" taille={26} />
        </button>
      ))}
    </div>
  );
}

export default function ProduitDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const { items, ajouter } = useCart();
  const favoris = useFavoris();
  const navigate = useNavigate();
  const { t } = useT();

  const [produit, setProduit] = useState(null);
  const [similaires, setSimilaires] = useState([]);
  const [avis, setAvis] = useState(null);
  const [erreur, setErreur] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [ajoute, setAjoute] = useState(false);
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [erreurAvis, setErreurAvis] = useState('');
  const [avisEnvoye, setAvisEnvoye] = useState(false);

  const chargerAvis = useCallback(() => {
    api(`/api/produits/${id}/avis`).then(setAvis).catch(() => setAvis(null));
  }, [id]);

  const charger = useCallback(() => {
    setErreur('');
    api(`/api/produits/${id}`)
      .then((p) => {
        setProduit(p);
        if (p.category_id) {
          api(`/api/produits?categorie=${p.category_id}&limit=5&page=1`)
            .then((r) => setSimilaires(r.data.filter((x) => x.id !== p.id).slice(0, 4)))
            .catch(() => setSimilaires([]));
        } else {
          setSimilaires([]);
        }
      })
      .catch((err) => setErreur(err.status === 404 ? t('detail.introuvable') : err.message));
  }, [id, t]);

  useEffect(() => {
    setQuantite(1); setAvisEnvoye(false);
    charger();
    chargerAvis();
    window.scrollTo({ top: 0 });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function envoyerAvis(e) {
    e.preventDefault();
    setErreurAvis('');
    if (!note) { setErreurAvis(t('avis.noteObligatoire')); return; }
    try {
      await api(`/api/produits/${id}/avis`, { method: 'POST', token, body: { note, commentaire } });
      setAvisEnvoye(true);
      setCommentaire('');
      chargerAvis();
      charger(); // la note moyenne du produit change
    } catch (err) {
      setErreurAvis(err.status === 403 ? t('avis.achatRequis') : err.message);
    }
  }

  async function supprimerAvis(avisId) {
    if (!window.confirm(t('avis.confirmerSuppression'))) return;
    try {
      await api(`/api/avis/${avisId}`, { method: 'DELETE', token });
      chargerAvis();
      charger();
    } catch (err) {
      setErreurAvis(err.message);
    }
  }

  if (erreur) {
    return (
      <div className="card center">
        <h1>{erreur}</h1>
        <p><Link to="/">{t('introuvable.retour')}</Link></p>
      </div>
    );
  }
  if (!produit) return <p className="muted">{t('commun.chargement')}</p>;

  const stock = etatStock(produit, t);
  const dansLePanier = items.find((i) => i.produit_id === produit.id)?.quantite || 0;
  const disponible = Math.max(produit.stock - dansLePanier, 0);
  const src = imageSrc(produit.image_url);
  const estFavori = favoris.estFavori(produit.id);
  const estClient = user?.role === 'client';

  function ajouterAuPanier() {
    ajouter(produit, quantite);
    setAjoute(true);
    setQuantite(1);
    setTimeout(() => setAjoute(false), 1500);
  }

  function clicFavori() {
    if (!user) {
      navigate('/login', { state: { from: `/produit/${id}`, message: t('favoris.connexionRequise') } });
      return;
    }
    favoris.basculer(produit.id);
  }

  return (
    <>
      <nav className="fil" aria-label="fil d'Ariane">
        <Link to="/">{t('nav.catalogue')}</Link>
        <span className="fil-fleche">›</span>
        <span>{produit.categorie_nom || t('produit.sansCategorie')}</span>
        <span className="fil-fleche">›</span>
        <span>{produit.nom}</span>
      </nav>

      <section className="detail">
        <div className="detail-image" style={{ '--teinte': teinte(produit.id) }}>
          {src ? <img src={src} alt={produit.nom} /> : <span>{produit.nom.charAt(0).toUpperCase()}</span>}
        </div>

        <div className="detail-infos">
          <span className="produit-categorie">{produit.categorie_nom || t('produit.sansCategorie')}</span>
          <h1>{produit.nom}</h1>
          <Etoiles note={produit.note_moyenne} nb={produit.nb_avis} taille={18} />
          {!produit.nb_avis && <span className="muted petit">{t('avis.aucunResume')}</span>}
          <div className="detail-prix">{formaterPrix(produit.prix)}</div>
          <span className={`badge ${stock.classe}`} style={{ justifySelf: 'start' }}>{stock.texte}</span>
          {produit.description && <p>{produit.description}</p>}

          {user?.role !== 'admin' && (
            <div className="detail-actions">
              <div className="qte">
                <button className="btn btn-light btn-small" aria-label={t('detail.moins')} disabled={quantite <= 1} onClick={() => setQuantite(quantite - 1)}>−</button>
                <span className="qte-valeur" aria-live="polite">{quantite}</span>
                <button className="btn btn-light btn-small" aria-label={t('detail.plus')} disabled={quantite >= disponible} onClick={() => setQuantite(quantite + 1)}>+</button>
              </div>
              <button className="btn" disabled={disponible <= 0} onClick={ajouterAuPanier}>
                {produit.stock <= 0 ? t('produit.indisponible') : disponible <= 0 ? t('produit.stockMax') : ajoute ? t('produit.ajoute') : t('produit.ajouter')}
              </button>
              <button className="btn btn-light" aria-pressed={estFavori} onClick={clicFavori}>
                <Icone nom="coeur" taille={18} style={estFavori ? { fill: 'currentColor', color: 'var(--harissa)' } : undefined} />
                {estFavori ? t('favoris.retirer') : t('favoris.ajouter')}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="card section-espace-bas" aria-labelledby="titre-avis">
        <h2 id="titre-avis">{t('avis.titre')}</h2>
        {avis && avis.total > 0 ? (
          <div className="avis-resume">
            <div className="avis-note">
              <strong>{Number(avis.moyenne).toFixed(1)}</strong>
              <Etoiles note={avis.moyenne} taille={18} />
              <div className="muted petit">{t('avis.nb', { n: avis.total })}</div>
            </div>
            <div className="repartition">
              {[5, 4, 3, 2, 1].map((n) => (
                <div key={n}>
                  <span>{n}★</span>
                  <span className="barre"><i style={{ width: `${(avis.repartition[n] / avis.total) * 100}%` }} /></span>
                  <span className="muted">{avis.repartition[n]}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted">{t('avis.aucun')}</p>
        )}

        {estClient && (
          avisEnvoye ? (
            <p className="succes">{t('avis.merci')}</p>
          ) : (
            <form className="avis-form" onSubmit={envoyerAvis}>
              <strong>{t('avis.donner')}</strong>
              <ChoixNote valeur={note} onChange={setNote} t={t} />
              <textarea
                rows="3"
                placeholder={t('avis.placeholder')}
                aria-label={t('avis.commentaire')}
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                maxLength={2000}
              />
              {erreurAvis && <p className="erreur">{erreurAvis}</p>}
              <button className="btn" style={{ justifySelf: 'start' }}>{t('avis.envoyer')}</button>
            </form>
          )
        )}
        {!user && <p className="muted petit"><Link to="/login" state={{ from: `/produit/${id}` }}>{t('avis.connexion')}</Link></p>}
        {user?.role === 'admin' && erreurAvis && <p className="erreur">{erreurAvis}</p>}

        {avis && avis.avis.length > 0 && (
          <div className="avis-liste">
            {avis.avis.map((a) => (
              <article key={a.id} className="avis-item">
                <header>
                  <strong>{a.auteur}</strong>
                  <Etoiles note={a.note} />
                  <span className="muted petit">{formaterDate(a.created_at, false)}</span>
                  {(user?.role === 'admin' || user?.id === a.user_id) && (
                    <button className="btn btn-light btn-small btn-danger" style={{ marginInlineStart: 'auto' }} onClick={() => supprimerAvis(a.id)}>
                      {t('commun.supprimer')}
                    </button>
                  )}
                </header>
                {a.commentaire && <p>{a.commentaire}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      {similaires.length > 0 && (
        <section aria-labelledby="titre-similaires">
          <h2 id="titre-similaires">{t('detail.similaires')}</h2>
          <div className="grille">
            {similaires.map((p) => <ProduitCard key={p.id} produit={p} />)}
          </div>
        </section>
      )}
    </>
  );
}
