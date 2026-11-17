// Petit "client HTTP" : tous les appels vers le backend passent par ici.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Avec { blob: true } on récupère un fichier (ex : la facture PDF) au lieu d'un JSON
export async function api(chemin, { method = 'GET', body, token, blob = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  // Si l'utilisateur est connecté, on envoie son token JWT dans l'en-tête
  if (token) headers.Authorization = `Bearer ${token}`;

  let reponse;
  try {
    reponse = await fetch(`${API_URL}${chemin}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch échoue (et ne renvoie aucune réponse) quand le serveur est éteint
    throw new Error("Impossible de joindre le serveur. Vérifiez que l'API est démarrée.");
  }

  if (blob && reponse.ok) {
    return reponse.blob();
  }

  const donnees = await reponse.json().catch(() => ({}));

  if (!reponse.ok) {
    // Le backend renvoie { message: "..." } en cas d'erreur
    const erreur = new Error(donnees.message || `Erreur ${reponse.status}`);
    erreur.status = reponse.status; // permet de distinguer 401 (session expirée), 400, etc.
    throw erreur;
  }
  return donnees;
}
