import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useT } from '../i18n.jsx';
import Icone from '../icons.jsx';

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
  const lien = (to, cle, icone, end = false) => (
    <NavLink to={to} end={end} className={classe}>
      <Icone nom={icone} />{t(cle)}
    </NavLink>
  );
  return (
    <div className="admin-layout">
      <nav className="sidebar" aria-label={t('nav.administration')}>
        <div className="sidebar-titre">{t('admin.groupe.vue')}</div>
        {lien('/admin', 'admin.nav.dashboard', 'tableau', true)}
        <div className="sidebar-titre">{t('admin.groupe.catalogue')}</div>
        {lien('/admin/produits', 'admin.nav.produits', 'produits')}
        {lien('/admin/categories', 'admin.nav.categories', 'categories')}
        {lien('/admin/codes-promo', 'admin.nav.promos', 'promo')}
        <div className="sidebar-titre">{t('admin.groupe.ventes')}</div>
        {lien('/admin/commandes', 'admin.nav.commandes', 'commandes')}
        <div className="sidebar-titre">{t('admin.groupe.stock')}</div>
        {lien('/admin/mouvements', 'admin.nav.mouvements', 'mouvements')}
        {lien('/admin/fournisseurs', 'admin.nav.fournisseurs', 'fournisseurs')}
        {lien('/admin/achats', 'admin.nav.achats', 'achats')}
        <div className="sidebar-titre">{t('admin.groupe.plateforme')}</div>
        {lien('/admin/integrations', 'admin.nav.integrations', 'cle')}
        {lien('/admin/audit', 'admin.nav.audit', 'journal')}
        {lien('/admin/emails', 'admin.nav.emails', 'courrier')}
      </nav>
      <div className="admin-contenu"><Outlet /></div>
    </div>
  );
}
