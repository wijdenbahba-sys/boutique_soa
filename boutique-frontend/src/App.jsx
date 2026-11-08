import { Routes, Route, Link } from 'react-router-dom';
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

// Chaque <Route> associe une URL à une page
export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Catalogue />} />
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
          </Route>

          <Route
            path="*"
            element={
              <div className="card center">
                <h1>Page introuvable</h1>
                <p><Link to="/">Retour au catalogue</Link></p>
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}
