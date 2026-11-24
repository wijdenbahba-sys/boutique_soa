// Branche les services sur le bus d'événements (appelé une fois au démarrage de l'application).
const { abonner } = require('../utils/evenements');
const webhooks = require('./webhooks');
const email = require('./email');

let actif = false;
function demarrer() {
  if (actif) return;
  actif = true;
  abonner(webhooks.distribuer, 'webhooks');
  abonner(email.traiterEvenement, 'emails');
  // (le flux SSE s'abonne lui-même à chaque connexion d'un administrateur)
}

module.exports = { demarrer };
