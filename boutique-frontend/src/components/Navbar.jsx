import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useCart } from '../CartContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { nombreArticles } = useCart();
  const navigate = useNavigate();

  function deconnecter() {
    logout();
    navigate('/');
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="logo">Boutique</Link>

        <nav className="navbar-links">
          <Link to="/">Catalogue</Link>
          {/* L'admin ne passe pas de commandes : pas de lien Panier pour lui */}
          {user?.role !== 'admin' && (
            <Link to="/panier">Panier{nombreArticles > 0 && ` (${nombreArticles})`}</Link>
          )}
          {user?.role === 'client' && <Link to="/commandes">Mes commandes</Link>}
          {user?.role === 'admin' && <Link to="/admin">Administration</Link>}
        </nav>

        <div className="navbar-user">
          {user ? (
            <>
              <span className="user-name">
                {user.nom} {user.role === 'admin' && <span className="badge badge-admin">admin</span>}
              </span>
              <button className="btn btn-light" onClick={deconnecter}>Déconnexion</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-light">Connexion</Link>
              <Link to="/register" className="btn">Inscription</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
