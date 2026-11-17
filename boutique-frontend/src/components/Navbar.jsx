import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useCart } from '../CartContext.jsx';
import { useT } from '../i18n.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { nombreArticles } = useCart();
  const { t, lang, setLang } = useT();
  const navigate = useNavigate();

  function deconnecter() {
    logout();
    navigate('/');
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="logo">{t('app.nom')}</Link>

        <nav className="navbar-links">
          <Link to="/">{t('nav.catalogue')}</Link>
          {/* L'admin ne passe pas de commandes : pas de lien Panier pour lui */}
          {user?.role !== 'admin' && (
            <Link to="/panier">{t('nav.panier')}{nombreArticles > 0 && ` (${nombreArticles})`}</Link>
          )}
          {user?.role === 'client' && <Link to="/commandes">{t('nav.mesCommandes')}</Link>}
          {user?.role === 'admin' && <Link to="/admin">{t('nav.administration')}</Link>}
        </nav>

        <div className="navbar-user">
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
              <span className="user-name">
                {user.nom} {user.role === 'admin' && <span className="badge badge-admin">{t('nav.admin')}</span>}
              </span>
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
