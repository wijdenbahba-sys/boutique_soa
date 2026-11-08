import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

// Protège toutes les pages /admin/... : il faut être connecté ET avoir le rôle admin.
// (Le backend vérifie aussi le rôle sur chaque route : cette garde sert à l'affichage.)
export default function RouteAdmin() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: '/admin', message: 'Connectez-vous avec un compte administrateur.' }}
      />
    );
  }
  if (user.role !== 'admin') {
    return (
      <div className="card center">
        <h1>Accès refusé</h1>
        <p className="muted">Cette section est réservée aux administrateurs.</p>
      </div>
    );
  }

  const classe = ({ isActive }) => (isActive ? 'actif' : '');
  return (
    <>
      <nav className="admin-nav">
        <NavLink to="/admin" end className={classe}>Tableau de bord</NavLink>
        <NavLink to="/admin/produits" className={classe}>Produits</NavLink>
        <NavLink to="/admin/commandes" className={classe}>Commandes</NavLink>
        <NavLink to="/admin/categories" className={classe}>Catégories</NavLink>
      </nav>
      <Outlet />
    </>
  );
}
