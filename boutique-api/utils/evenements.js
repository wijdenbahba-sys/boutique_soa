// Bus d'événements du domaine : les contrôleurs appellent emettre() APRÈS le commit,
// les abonnés (SSE, webhooks, emails) réagissent sans jamais pouvoir faire échouer la requête.
const { EventEmitter } = require('events');

const TYPES = [
  'commande.creee', 'commande.statut', 'commande.annulee', 'stock.bas', 'achat.recu', 'avis.cree',
];
const TAILLE_HISTORIQUE = 50;

const journalErreur = (...args) => {
  if (process.env.NODE_ENV !== 'test' || process.env.TEST_LOG_EVENTS) console.error(...args);
};

const bus = new EventEmitter();
bus.setMaxListeners(0); // une connexion SSE = un abonné

let compteur = 0;
let historique = []; // du plus ancien au plus récent

const abonnes = new Set();

// S'abonner à tous les événements. Retourne une fonction de désabonnement.
// Un abonné qui plante (exception ou promesse rejetée) est journalisé puis ignoré.
function abonner(fn, nom = 'abonné') {
  const ecouteur = (evenement) => {
    try {
      const r = fn(evenement);
      if (r && typeof r.catch === 'function') {
        r.catch((err) => journalErreur(`[evenements] ${nom} a échoué :`, err && err.message));
      }
    } catch (err) {
      journalErreur(`[evenements] ${nom} a échoué :`, err && err.message);
    }
  };
  abonnes.add(ecouteur);
  bus.on('evenement', ecouteur);
  return () => {
    abonnes.delete(ecouteur);
    bus.off('evenement', ecouteur);
  };
}

// Publie un événement : { id, type, date, donnees }. Ne lance jamais d'exception.
function emettre(type, donnees = {}) {
  const evenement = { id: ++compteur, type, date: new Date().toISOString(), donnees };
  try {
    historique.push(evenement);
    if (historique.length > TAILLE_HISTORIQUE) historique.shift();
    bus.emit('evenement', evenement);
  } catch (err) {
    journalErreur('[evenements] émission :', err && err.message);
  }
  return evenement;
}

// Derniers événements, du plus récent au plus ancien
function derniers(n = TAILLE_HISTORIQUE) {
  return historique.slice(-n).reverse();
}

// Pour les tests
function reinitialiser() {
  historique = [];
  compteur = 0;
}

module.exports = { TYPES, emettre, abonner, derniers, reinitialiser, bus };
