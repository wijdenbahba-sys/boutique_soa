// Fonctions utilitaires partagées

// 45 -> "45.00 DT"
export function formaterPrix(prix) {
  return `${Number(prix).toFixed(2)} DT`;
}

// Aspect de chaque statut de commande : texte affiché + couleur du badge
export const STATUTS = {
  en_attente: { texte: 'En attente', classe: 'badge-faible' },
  confirmee: { texte: 'Confirmée', classe: 'badge-info' },
  expediee: { texte: 'Expédiée', classe: 'badge-info' },
  livree: { texte: 'Livrée', classe: 'badge-ok' },
  annulee: { texte: 'Annulée', classe: 'badge-rupture' },
};

// "2026-10-17T09:51:45.000Z" -> "17/10/2026 10:51" (heure de l'utilisateur)
export function formaterDate(dateIso) {
  return new Date(dateIso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}
