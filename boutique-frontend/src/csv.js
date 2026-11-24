// Petites fonctions pour lire / télécharger des fichiers CSV (sans bibliothèque).

// Détecte le séparateur (; ou ,) d'après la première ligne : Excel français utilise ";"
function separateur(texte) {
  const premiere = texte.split(/\r?\n/, 1)[0] || '';
  return (premiere.match(/;/g) || []).length >= (premiere.match(/,/g) || []).length ? ';' : ',';
}

// Lit un texte CSV (guillemets, séparateurs dans les champs, retours à la ligne) -> tableau de lignes
export function lireCsv(texte) {
  const brut = texte.replace(/^﻿/, ''); // enlève le BOM d'Excel
  const sep = separateur(brut);
  const lignes = [];
  let ligne = [];
  let champ = '';
  let entreGuillemets = false;
  for (let i = 0; i < brut.length; i += 1) {
    const c = brut[i];
    if (entreGuillemets) {
      if (c === '"' && brut[i + 1] === '"') { champ += '"'; i += 1; }
      else if (c === '"') entreGuillemets = false;
      else champ += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && brut[i + 1] === '\n') i += 1;
      ligne.push(champ); champ = '';
      if (ligne.some((v) => v.trim() !== '')) lignes.push(ligne);
      ligne = [];
    } else champ += c;
  }
  ligne.push(champ);
  if (ligne.some((v) => v.trim() !== '')) lignes.push(ligne);
  return lignes;
}

// Transforme les lignes d'un CSV (1ère ligne = titres) en liste de produits pour l'API
// Colonnes reconnues : nom, description, prix, stock, seuil_alerte (ou seuil), categorie
export function csvVersProduits(texte) {
  const lignes = lireCsv(texte);
  if (lignes.length < 2) return [];
  const titres = lignes[0].map((t) => t.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_'));
  const col = (...noms) => titres.findIndex((t) => noms.includes(t));
  const iNom = col('nom', 'name', 'produit');
  const iDesc = col('description');
  const iPrix = col('prix', 'price');
  const iStock = col('stock', 'quantite');
  const iSeuil = col('seuil_alerte', 'seuil');
  const iCat = col('categorie', 'category');
  return lignes.slice(1).map((l) => {
    const prod = {
      nom: (l[iNom] ?? '').trim(),
      prix: (l[iPrix] ?? '').trim().replace(',', '.'),
      stock: (l[iStock] ?? '0').trim() || '0',
    };
    if (iDesc >= 0 && l[iDesc]) prod.description = l[iDesc].trim();
    if (iSeuil >= 0 && l[iSeuil]?.trim()) prod.seuil_alerte = l[iSeuil].trim();
    if (iCat >= 0 && l[iCat]?.trim()) prod.categorie = l[iCat].trim();
    return prod;
  });
}

// Déclenche le téléchargement d'un fichier (blob) dans le navigateur
export function telecharger(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
