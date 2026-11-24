import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useCart } from '../CartContext.jsx';
import { useT } from '../i18n.jsx';
import { useTheme } from '../theme.jsx';
import Icone from '../icons.jsx';
import Cloche from './Cloche.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { nombreArticles } = useCart();
  const { t, lang, setLang } = useT();
  const { theme, basculer } = useTheme();
  const navigate = useNavigate();
  const enAdmin = useLocation().pathname.startsWith('/admin');
  const classe = ({ isActive }) => (isActive ? 'actif' : '');

  function deconnecter() {
    logout();
    navigate('/');
  }

  return (
    <header className={`navbar ${enAdmin ? 'container-admin-nav' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="logo">
          <span className="logo-marque" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffc83d" strokeWidth="2" strokeLinejoin="round">
              <rect x="5" y="5" width="14" height="14" />
              <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
            </svg>
          </span>
          {t('app.nom')}
        </Link>

        <nav className="navbar-links">
          <NavLink to="/" end className={classe}><Icone nom="accueil" taille={18} />{t('nav.catalogue')}</NavLink>
          {/* L'admin ne passe pas de commandes : pas de panier ni de favoris pour lui */}
          {user?.role !== 'admin' && (
            <NavLink to="/panier" className={classe}>
              <Icone nom="panier" taille={18} />{t('nav.panier')}
              {nombreArticles > 0 && <span className="compteur">{nombreArticles}</span>}
            </NavLink>
          )}
          {user?.role === 'client' && (
            <>
              <NavLink to="/favoris" className={classe}><Icone nom="coeur" taille={18} />{t('nav.favoris')}</NavLink>
              <NavLink to="/commandes" className={classe}><Icone nom="commandes" taille={18} />{t('nav.mesCommandes')}</NavLink>
            </>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={classe}><Icone nom="tableau" taille={18} />{t('nav.administration')}</NavLink>
          )}
        </nav>

        <div className="navbar-user">
          <button
            className="btn btn-light btn-small palette-declencheur"
            onClick={() => window.dispatchEvent(new Event('ouvrir-palette'))}
            aria-label={t('palette.titre')}
            title={t('palette.titre')}
          >
            <Icone nom="recherche" taille={16} /><kbd>Ctrl K</kbd>
          </button>
          {user?.role === 'admin' && <Cloche />}
          <button
            className="btn btn-light btn-icone"
            onClick={basculer}
            aria-label={theme === 'dark' ? t('nav.themeClair') : t('nav.themeSombre')}
            title={theme === 'dark' ? t('nav.themeClair') : t('nav.themeSombre')}
          >
            <Icone nom={theme === 'dark' ? 'soleil' : 'lune'} taille={18} />
          </button>
          {/* Bouton de langue : affiche la langue vers laquelle on bascule */}
          <button
            className="btn btn-light btn-small"
            onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
            title={t('nav.changerLangue')}
            lang={lang === 'fr' ? 'ar' : 'fr'}
          >
            {lang === 'fr' ? 'العربية' : 'Français'}
          </button>
          {user ? (
            <>
              {user.role === 'client' ? (
                <Link to="/profil" className="user-name" title={t('nav.profil')}>{user.nom}</Link>
              ) : (
                <span className="user-name">
                  {user.nom} <span className="badge badge-admin">{t('nav.admin')}</span>
                </span>
              )}
              <button className="btn btn-light" onClick={deconnecter}>{t('nav.deconnexion')}</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-light">{t('nav.connexion')}</Link>
              <Link to="/register" className="btn">{t('nav.inscription')}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
