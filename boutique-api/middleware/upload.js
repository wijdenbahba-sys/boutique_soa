const multer = require('multer');

const TAILLE_MAX = 2 * 1024 * 1024; // 2 Mo

// Le fichier reste en mémoire (2 Mo max) : le controller en vérifie le contenu réel avant de l'écrire sur disque.
const televerser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAILLE_MAX, files: 1, fields: 5 },
});

// Lit un fichier du champ "image" et transforme les erreurs de multer en réponses claires.
function recevoirImage(req, res, next) {
  televerser.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Image trop volumineuse (2 Mo maximum)' });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: 'Envoi invalide : un seul fichier dans le champ "image" est accepté' });
    }
    // Corps qui n'est pas du multipart, etc.
    return res.status(400).json({ message: 'Envoi invalide : utilisez multipart/form-data avec le champ "image"' });
  });
}

module.exports = { recevoirImage };
