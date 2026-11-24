import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Catalogue from './pages/Catalogue.jsx';
import Panier from './pages/Panier.jsx';
import MesCommandes from './pages/MesCommandes.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import RouteAdmin from './components/RouteAdmin.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import AdminProduits from './pages/admin/AdminProduits.jsx';
import ProduitForm from './pages/admin/ProduitForm.jsx';
import AdminCommandes from './pages/admin/AdminCommandes.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminMouvements from './pages/admin/AdminMouvements.jsx';
import AdminFournisseurs from './pages/admin/AdminFournisseurs.jsx';
import AdminAchats from './pages/admin/AdminAchats.jsx';
import AchatForm from './pages/admin/AchatForm.jsx';
import AdminCodesPromo from './pages/admin/AdminCodesPromo.jsx';
import AdminIntegrations from './pages/admin/AdminIntegrations.jsx';
import AdminAudit from './pages/admin/AdminAudit.jsx';
import AdminEmails from './pages/admin/AdminEmails.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import ProduitDetail from './pages/ProduitDetail.jsx';
import Favoris from './pages/Favoris.jsx';
import Profil from './pages/Profil.jsx';
import { useT } from './i18n.jsx';

// Chaque <Route> associe une URL à une page
export default function App() {
  const { t } = useT();
  const enAdmin = useLocation().pathname.startsWith('/admin');
  return (
    <>
      <Navbar />
      <CommandPalette />
      <main className={enAdmin ? 'container container-admin' : 'container'}>
        <Routes>
          <Route path="/" element={<Catalogue />} />
          <Route path="/produit/:id" element={<ProduitDetail />} />
          <Route path="/favoris" element={<Favoris />} />
          <Route path="/profil" element={<Profil />} />
          <Route path="/panier" element={<Panier />} />
          <Route path="/commandes" element={<MesCommandes />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Espace administrateur : toutes les routes /admin/... passent par RouteAdmin */}
          <Route path="/admin" element={<RouteAdmin />}>
            <Route index element={<Dashboard />} />
            <Route path="produits" element={<AdminProduits />} />
            <Route path="produits/nouveau" element={<ProduitForm />} />
            <Route path="produits/:id" element={<ProduitForm />} />
            <Route path="commandes" element={<AdminCommandes />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="codes-promo" element={<AdminCodesPromo />} />
            <Route path="mouvements" element={<AdminMouvements />} />
            <Route path="fournisseurs" element={<AdminFournisseurs />} />
            <Route path="achats" element={<AdminAchats />} />
            <Route path="achats/nouveau" element={<AchatForm />} />
            <Route path="integrations" element={<AdminIntegrations />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="emails" element={<AdminEmails />} />
          </Route>

          <Route
            path="*"
            element={
              <div className="card center">
                <h1>{t('introuvable.titre')}</h1>
                <p><Link to="/">{t('introuvable.retour')}</Link></p>
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}
