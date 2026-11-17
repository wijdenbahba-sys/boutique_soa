// Fonctions utilitaires partagées

// Langue courante : mise à jour par LangProvider (voir i18n.jsx) pour que les prix et les dates
// s'affichent dans la bonne langue partout, sans passer la langue en paramètre.
let langueCourante = 'fr';
export function definirLangue(lang) {
  langueCourante = lang;
}

// 45 -> "45.00 DT" (ou "45.00 د.ت" en arabe)
export function formaterPrix(prix) {
  return `${Number(prix).toFixed(2)} ${langueCourante === 'ar' ? 'د.ت' : 'DT'}`;
}

// Couleur du badge de chaque statut de commande (le texte vient des traductions : statut.<clé>)
export const STATUTS = {
  en_attente: { classe: 'badge-faible' },
  confirmee: { classe: 'badge-info' },
  expediee: { classe: 'badge-info' },
  livree: { classe: 'badge-ok' },
  annulee: { classe: 'badge-rupture' },
};

// Chiffres latins (0-9) même en arabe : plus lisibles pour des prix et des dates
const LOCALES = { fr: 'fr-FR', ar: 'ar-TN-u-nu-latn' };

// "2026-10-17T09:51:45.000Z" -> "17/10/2026 10:51" (heure de l'utilisateur)
export function formaterDate(dateIso, avecHeure = true) {
  const options = avecHeure ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' };
  return new Date(dateIso).toLocaleString(LOCALES[langueCourante], options);
}
