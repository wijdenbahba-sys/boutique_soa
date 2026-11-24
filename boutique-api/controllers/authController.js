const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { journaliser } = require('../utils/audit');

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    // nom, email et mot de passe sont déjà validés (middleware valider(schemas.register))
    const { nom, email, mot_de_passe } = req.body;

    const hash = await bcrypt.hash(mot_de_passe, 10);

    // Le rôle est toujours "client" à l'inscription (jamais choisi par l'utilisateur)
    const [result] = await pool.query(
      'INSERT INTO users (nom, email, mot_de_passe, role) VALUES (?, ?, ?, ?)',
      [nom, email, hash, 'client']
    );

    res.status(201).json({
      message: 'Compte créé avec succès',
      user: { id: result.insertId, nom, email, role: 'client' },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cet email est déjà utilisé' });
    }
    next(err);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, mot_de_passe } = req.body;

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    // Même message dans les deux cas pour ne pas révéler si l'email existe
    if (!user || !(await bcrypt.compare(mot_de_passe, user.mot_de_passe))) {
      await journaliser(req, { action: 'connexion_echec', entite: 'utilisateur', entite_id: user ? user.id : null, details: { email } });
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    if (user.role === 'admin') {
      req.auditUser = { id: user.id, nom: user.nom };
      await journaliser(req, { action: 'connexion', entite: 'utilisateur', entite_id: user.id });
    }
    res.json({
      token,
      user: { id: user.id, nom: user.nom, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
exports.me = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nom, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/auth/profil   body : { "nom": "...", "email": "..." }
exports.modifierProfil = async (req, res, next) => {
  try {
    const { nom, email } = req.body;
    const [result] = await pool.query('UPDATE users SET nom = ?, email = ? WHERE id = ?', [nom, email, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    const [rows] = await pool.query('SELECT id, nom, email, role FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: 'Profil mis à jour', user: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cet email est déjà utilisé' });
    }
    next(err);
  }
};

// PUT /api/auth/mot-de-passe   body : { "ancien": "...", "nouveau": "..." }
exports.changerMotDePasse = async (req, res, next) => {
  try {
    const { ancien, nouveau } = req.body;
    const [rows] = await pool.query('SELECT mot_de_passe FROM users WHERE id = ?', [req.user.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    if (!(await bcrypt.compare(ancien, rows[0].mot_de_passe))) {
      return res.status(400).json({ message: 'Ancien mot de passe incorrect' });
    }
    const hash = await bcrypt.hash(nouveau, 10);
    await pool.query('UPDATE users SET mot_de_passe = ? WHERE id = ?', [hash, req.user.id]);
    await journaliser(req, { action: 'changer_mot_de_passe', entite: 'utilisateur', entite_id: req.user.id });
    res.json({ message: 'Mot de passe modifié' });
  } catch (err) {
    next(err);
  }
};
