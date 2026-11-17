// Valide req.body (ou req.query) avec un schéma zod.
// Si c'est invalide : 400 { message, erreurs }. Sinon req.body contient les données nettoyées
// (espaces retirés, nombres convertis, valeurs par défaut appliquées).
function valider(schema, source = 'body') {
  return (req, res, next) => {
    const resultat = schema.safeParse(req[source] ?? {});
    if (!resultat.success) {
      const erreurs = resultat.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message }));
      return res.status(400).json({ message: erreurs[0].message, erreurs });
    }
    req[source] = resultat.data;
    next();
  };
}

module.exports = valider;
