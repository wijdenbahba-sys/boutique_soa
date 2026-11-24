// Petites icônes SVG (trait 2px), sans bibliothèque externe.
const CHEMINS = {
  accueil: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  panier: 'M3 4h2l2.4 11h10.2L20 7H6M9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z',
  coeur: 'M12 20s-7-4.4-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.6-9 9-9 9z',
  commandes: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6',
  profil: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  tableau: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
  produits: 'M12 3l9 5v8l-9 5-9-5V8l9-5zM3 8l9 5 9-5M12 13v8',
  categories: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  mouvements: 'M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3',
  fournisseurs: 'M3 7l2-4h14l2 4M3 7v13h18V7M3 7h18M9 12h6',
  achats: 'M3 3h2l.5 3M5.5 6H21l-2 8H8L5.5 6zM9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z',
  promo: 'M20 12l-8 8-9-9V3h8l9 9zM7.5 7.5h.01',
  lune: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
  soleil: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  camion: 'M2 6h11v10H2zM13 9h4l3 3v4h-7M6 19a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4z',
  bouclier: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  etiquette: 'M20 12l-8 8-9-9V3h8l9 9z',
  telecharger: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  televerser: 'M12 15V3M7 8l5-5 5 5M4 21h16',
  cloche: 'M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 004 0',
  cle: 'M9 11a4 4 0 118 0 4 4 0 01-8 0zM11.5 14L4 21.5M7 18l2.5 2.5',
  journal: 'M6 3h10l4 4v14H6zM15 3v5h5M9 12h8M9 16h8',
  courrier: 'M3 6h18v12H3zM3 7l9 7 9-7',
  recherche: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  carte: 'M3 6h18v12H3zM3 10h18M7 15h3',
  eclair: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  lien: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  etoile: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9L12 2.5z',
};

export default function Icone({ nom, taille = 20, ...props }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill={nom === 'etoile' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={CHEMINS[nom]} />
    </svg>
  );
}
