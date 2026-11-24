// Génération de fichiers CSV compatibles Excel : séparateur ";", BOM UTF-8 (accents corrects), fins de ligne CRLF.
const SEPARATEUR = ';';

// Un texte qui commence par = + - @ (ou tabulation / retour chariot) serait interprété comme une formule par
// Excel : on le neutralise avec une apostrophe (injection de formules CSV).
function neutraliser(valeur) {
  return /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur;
}

function cellule(valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (valeur instanceof Date) return valeur.toISOString().replace('T', ' ').slice(0, 19);
  let texte = typeof valeur === 'string' ? neutraliser(valeur) : String(valeur); // les nombres restent tels quels
  if (/[;"\r\n]/.test(texte)) texte = `"${texte.replace(/"/g, '""')}"`;
  return texte;
}

// colonnes : [{ cle: 'nom', titre: 'Nom' }, ...]
function versCsv(colonnes, lignes) {
  const entete = colonnes.map((c) => cellule(c.titre)).join(SEPARATEUR);
  const corps = lignes.map((l) => colonnes.map((c) => cellule(l[c.cle])).join(SEPARATEUR));
  return '﻿' + [entete, ...corps].join('\r\n') + '\r\n';
}

module.exports = { versCsv, neutraliser };
