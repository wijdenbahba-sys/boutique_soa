import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './AuthContext.jsx';
import { CartProvider } from './CartContext.jsx';
import { LangProvider } from './i18n.jsx';
import './styles.css';

// BrowserRouter : active la navigation entre les pages (sans recharger le site)
// LangProvider  : langue de l'interface (français / arabe) accessible partout
// AuthProvider  : rend l'utilisateur connecté accessible dans toute l'application
// CartProvider  : rend le panier accessible dans toute l'application
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LangProvider>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  </React.StrictMode>
);
