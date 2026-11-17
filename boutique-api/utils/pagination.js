// Pagination : ?page=2&limit=10   Tri : ?tri=prix&ordre=desc

function entierPositif(valeur, defaut) {
  const n = parseInt(valeur, 10);
  return Number.isInteger(n) && n > 0 ? n : defaut;
}

// pagine = true seulement si le client a demandé une page (sinon on garde l'ancien format : un simple tableau)
function lirePagination(query, { limiteParDefaut = 10, limiteMax = 100, forcer = false } = {}) {
  const pagine = forcer || query.page !== undefined || query.limit !== undefined;
  const page = entierPositif(query.page, 1);
  const limit = Math.min(entierPositif(query.limit, limiteParDefaut), limiteMax);
  return { pagine, page, limit, offset: (page - 1) * limit };
}

// Construit "ORDER BY colonne direction" à partir d'une liste blanche
// (jamais de texte du client directement dans le SQL : sinon injection possible).
function construireTri(query, colonnes, defaut) {
  const colonne = colonnes[query.tri] || defaut;
  const ordre = String(query.ordre).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return { colonne, ordre, sql: `ORDER BY ${colonne} ${ordre}` };
}

function reponsePaginee(data, total, { page, limit }) {
  return { data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

module.exports = { lirePagination, construireTri, reponsePaginee };
