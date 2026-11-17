import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useT } from '../i18n.jsx';

// Protège toutes les pages /admin/... : il faut être connecté ET avoir le rôle admin.
// (Le backend vérifie aussi le rôle sur chaque route : cette garde sert à l'affichage.)
export default function RouteAdmin() {
  const { user } = useAuth();
  const { t } = useT();

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: '/admin', message: t('admin.connexionRequise') }}
      />
    );
  }
  if (user.role !== 'admin') {
    return (
      <div className="card center">
        <h1>{t('admin.accesRefuse')}</h1>
        <p className="muted">{t('admin.reserve')}</p>
      </div>
    );
  }

  const classe = ({ isActive }) => (isActive ? 'actif' : '');
  return (
    <>
      <nav className="admin-nav">
        <NavLink to="/admin" end className={classe}>{t('admin.nav.dashboard')}</NavLink>
        <NavLink to="/admin/produits" className={classe}>{t('admin.nav.produits')}</NavLink>
        <NavLink to="/admin/commandes" className={classe}>{t('admin.nav.commandes')}</NavLink>
        <NavLink to="/admin/categories" className={classe}>{t('admin.nav.categories')}</NavLink>
        <NavLink to="/admin/mouvements" className={classe}>{t('admin.nav.mouvements')}</NavLink>
        <NavLink to="/admin/fournisseurs" className={classe}>{t('admin.nav.fournisseurs')}</NavLink>
        <NavLink to="/admin/achats" className={classe}>{t('admin.nav.achats')}</NavLink>
      </nav>
      <Outlet />
    </>
  );
}
