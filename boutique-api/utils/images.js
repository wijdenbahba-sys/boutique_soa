const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Dossier des images envoyées (configurable avec UPLOAD_DIR, par exemple un volume Docker)
function dossierUploads() {
  const dossier = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '..', 'uploads');
  fs.mkdirSync(dossier, { recursive: true });
  return dossier;
}

// On ne se fie pas au type annoncé par le navigateur : on lit les premiers octets du fichier.
function detecterFormat(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// Enregistre l'image sous un nom aléatoire et renvoie l'URL publique ("/uploads/xxxx.png")
function enregistrerImage(buf, extension) {
  const nom = `${crypto.randomBytes(16).toString('hex')}.${extension}`;
  fs.writeFileSync(path.join(dossierUploads(), nom), buf);
  return `/uploads/${nom}`;
}

// Supprime un fichier du dossier d'uploads (ignore les URL externes et les chemins douteux)
function supprimerImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
  const fichier = path.join(dossierUploads(), path.basename(imageUrl));
  try {
    fs.unlinkSync(fichier);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Suppression image impossible :', err.message);
  }
}

module.exports = { dossierUploads, detecterFormat, enregistrerImage, supprimerImage };
