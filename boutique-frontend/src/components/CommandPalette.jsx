import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useT } from '../i18n.jsx';
import { useTheme } from '../theme.jsx';
import { api, imageSrc } from '../api.js';
import { formaterPrix } from '../utils.js';
import Icone from '../icons.jsx';

// Palette de commandes (Ctrl+K ou Cmd+K) : aller à une page, changer de thème/langue ou chercher un produit au clavier.
export default function CommandPalette() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useT();
  const { basculer } = useTheme();
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const [requete, setRequete] = useState('');
  const [produits, setProduits] = useState([]);
  const [index, setIndex] = useState(0);
  const champ = useRef(null);

  // Raccourci global
  useEffect(() => {
    const touche = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOuvert((o) => !o);
      } else if (e.key === 'Escape') setOuvert(false);
    };
    const ouvrir = () => setOuvert(true);
    window.addEventListener('keydown', touche);
    window.addEventListener('ouvrir-palette', ouvrir);
    return () => { window.removeEventListener('keydown', touche); window.removeEventListener('ouvrir-palette', ouvrir); };
  }, []);

  useEffect(() => {
    if (ouvert) { setRequete(''); setProduits([]); setIndex(0); }
  }, [ouvert]);

  // Recherche de produits (avec un petit délai pour ne pas appeler l'API à chaque lettre)
  useEffect(() => {
    const q = requete.trim();
    if (!ouvert || q.length < 2) { setProduits([]); return undefined; }
    let annule = false;
    const minuterie = setTimeout(() => {
      api(`/api/produits?search=${encodeURIComponent(q)}&page=1&limit=5`)
        .then((r) => { if (!annule) setProduits(r.data || []); })
        .catch(() => {});
    }, 200);
    return () => { annule = true; clearTimeout(minuterie); };
  }, [requete, ouvert]);

  const commandes = useMemo(() => {
    const aller = (chemin) => () => navigate(chemin);
    const liste = [{ id: 'catalogue', libelle: t('nav.catalogue'), icone: 'accueil', groupe: t('palette.pages'), action: aller('/') }];
    if (user?.role === 'client') {
      liste.push(
        { id: 'panier', libelle: t('nav.panier'), icone: 'panier', groupe: t('palette.pages'), action: aller('/panier') },
        { id: 'favoris', libelle: t('nav.favoris'), icone: 'coeur', groupe: t('palette.pages'), action: aller('/favoris') },
        { id: 'commandes', libelle: t('nav.mesCommandes'), icone: 'commandes', groupe: t('palette.pages'), action: aller('/commandes') },
        { id: 'profil', libelle: t('nav.profil'), icone: 'profil', groupe: t('palette.pages'), action: aller('/profil') },
      );
    }
    if (!user) {
      liste.push(
        { id: 'panier', libelle: t('nav.panier'), icone: 'panier', groupe: t('palette.pages'), action: aller('/panier') },
        { id: 'login', libelle: t('nav.connexion'), icone: 'profil', groupe: t('palette.pages'), action: aller('/login') },
      );
    }
    if (user?.role === 'admin') {
      const g = t('palette.admin');
      liste.push(
        { id: 'a-dash', libelle: t('admin.nav.dashboard'), icone: 'tableau', groupe: g, action: aller('/admin') },
        { id: 'a-prod', libelle: t('admin.nav.produits'), icone: 'produits', groupe: g, action: aller('/admin/produits') },
        { id: 'a-new', libelle: t('palette.nouveauProduit'), icone: 'produits', groupe: g, action: aller('/admin/produits/nouveau') },
        { id: 'a-cmd', libelle: t('admin.nav.commandes'), icone: 'commandes', groupe: g, action: aller('/admin/commandes') },
        { id: 'a-promo', libelle: t('admin.nav.promos'), icone: 'promo', groupe: g, action: aller('/admin/codes-promo') },
        { id: 'a-mvt', libelle: t('admin.nav.mouvements'), icone: 'mouvements', groupe: g, action: aller('/admin/mouvements') },
        { id: 'a-ach', libelle: t('admin.nav.achats'), icone: 'achats', groupe: g, action: aller('/admin/achats') },
        { id: 'a-int', libelle: t('admin.nav.integrations'), icone: 'cle', groupe: g, action: aller('/admin/integrations') },
        { id: 'a-aud', libelle: t('admin.nav.audit'), icone: 'journal', groupe: g, action: aller('/admin/audit') },
        { id: 'a-mail', libelle: t('admin.nav.emails'), icone: 'courrier', groupe: g, action: aller('/admin/emails') },
      );
    }
    const a = t('palette.actions');
    liste.push(
      { id: 'theme', libelle: t('palette.theme'), icone: 'lune', groupe: a, action: basculer },
      { id: 'langue', libelle: lang === 'fr' ? 'العربية' : 'Français', icone: 'lien', groupe: a, action: () => setLang(lang === 'fr' ? 'ar' : 'fr') },
    );
    if (user) liste.push({ id: 'out', libelle: t('nav.deconnexion'), icone: 'profil', groupe: a, action: () => { logout(); navigate('/'); } });
    return liste;
  }, [t, user, lang, basculer, setLang, logout, navigate]);

  const q = requete.trim().toLowerCase();
  const resultats = useMemo(() => {
    const filtrees = commandes.filter((c) => !q || c.libelle.toLowerCase().includes(q));
    const lignesProduits = produits.map((p) => ({
      id: `p${p.id}`, libelle: p.nom, detail: formaterPrix(p.prix), image: imageSrc(p.image_url),
      icone: 'produits', groupe: t('palette.produits'), action: () => navigate(`/produit/${p.id}`),
    }));
    return [...lignesProduits, ...filtrees];
  }, [commandes, produits, q, t, navigate]);

  useEffect(() => { setIndex(0); }, [requete, produits]);

  if (!ouvert) return null;

  function clavier(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, resultats.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && resultats[index]) { e.preventDefault(); setOuvert(false); resultats[index].action(); }
  }

  let groupeCourant = null;
  return (
    <div className="palette-fond" onMouseDown={(e) => { if (e.target === e.currentTarget) setOuvert(false); }}>
      <div className="palette card" role="dialog" aria-modal="true" aria-label={t('palette.titre')}>
        <div className="palette-champ">
          <Icone nom="recherche" taille={18} />
          <input
            ref={champ}
            autoFocus
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            onKeyDown={clavier}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-liste"
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-liste" id="palette-liste" role="listbox">
          {resultats.length === 0 && <li className="palette-vide muted">{t('palette.aucun')}</li>}
          {resultats.map((r, i) => {
            const entete = r.groupe !== groupeCourant ? r.groupe : null;
            groupeCourant = r.groupe;
            return (
              <li key={r.id} role="presentation">
                {entete && <div className="palette-groupe">{entete}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  className={`palette-item ${i === index ? 'actif' : ''}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => { setOuvert(false); r.action(); }}
                >
                  {r.image ? <img src={r.image} alt="" /> : <Icone nom={r.icone} taille={18} />}
                  <span>{r.libelle}</span>
                  {r.detail && <span className="muted petit">{r.detail}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="palette-pied muted petit">
          <span><kbd>↑</kbd><kbd>↓</kbd> {t('palette.naviguer')}</span>
          <span><kbd>↵</kbd> {t('palette.ouvrir')}</span>
        </div>
      </div>
    </div>
  );
}
