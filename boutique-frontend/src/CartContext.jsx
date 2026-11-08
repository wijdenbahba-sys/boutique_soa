import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);

// Le panier est gardé dans le localStorage : il survit au rechargement de la page.
function lirePanier() {
  try {
    const donnees = JSON.parse(localStorage.getItem('panier') || '[]');
    return Array.isArray(donnees) ? donnees : [];
  } catch {
    return [];
  }
}

// Un élément du panier : { produit_id, nom, prix, stock, quantite }
export function CartProvider({ children }) {
  const [items, setItems] = useState(lirePanier);

  // À chaque modification du panier, on le sauvegarde
  useEffect(() => {
    try {
      localStorage.setItem('panier', JSON.stringify(items));
    } catch {
      /* stockage bloqué : le panier reste valable jusqu'au rechargement */
    }
  }, [items]);

  function ajouter(produit, quantite = 1) {
    setItems((courant) => {
      const existant = courant.find((i) => i.produit_id === produit.id);
      if (existant) {
        // Déjà dans le panier : on augmente la quantité (sans dépasser le stock)
        return courant.map((i) =>
          i.produit_id === produit.id
            ? { ...i, stock: produit.stock, quantite: Math.min(i.quantite + quantite, produit.stock) }
            : i
        );
      }
      if (produit.stock <= 0) return courant; // produit en rupture : on n'ajoute rien
      return [
        ...courant,
        {
          produit_id: produit.id,
          nom: produit.nom,
          prix: produit.prix,
          stock: produit.stock,
          quantite: Math.min(quantite, produit.stock),
        },
      ];
    });
  }

  function changerQuantite(produitId, quantite) {
    setItems((courant) =>
      courant.flatMap((i) => {
        if (i.produit_id !== produitId) return [i];
        if (quantite < 1) return []; // quantité 0 = on retire la ligne
        return [{ ...i, quantite: Math.min(quantite, i.stock) }];
      })
    );
  }

  function retirer(produitId) {
    setItems((courant) => courant.filter((i) => i.produit_id !== produitId));
  }

  function vider() {
    setItems([]);
  }

  const nombreArticles = items.reduce((somme, i) => somme + i.quantite, 0);
  const total = Math.round(items.reduce((somme, i) => somme + i.prix * i.quantite, 0) * 100) / 100;

  const valeur = { items, ajouter, changerQuantite, retirer, vider, nombreArticles, total };
  return <CartContext.Provider value={valeur}>{children}</CartContext.Provider>;
}

// Hook pratique : const { items, ajouter, total } = useCart();
export function useCart() {
  return useContext(CartContext);
}
