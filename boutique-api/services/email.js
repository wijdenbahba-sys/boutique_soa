// Emails transactionnels : SMTP réel si SMTP_HOST est défini, sinon mode simulation (rien n'est envoyé,
// mais chaque email est enregistré dans la table "emails" pour être consulté depuis l'administration).
const nodemailer = require('nodemailer');
const pool = require('../config/db');

const EXPEDITEUR = () => process.env.EMAIL_FROM || 'Boutique <no-reply@boutique.tn>';

let transport = null;
let signature = null;
function obtenirTransport() {
  const cle = JSON.stringify([process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER, process.env.SMTP_SECURE]);
  if (transport && signature === cle) return transport;
  signature = cle;
  if (process.env.SMTP_HOST) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  } else {
    transport = nodemailer.createTransport({ jsonTransport: true });
  }
  return transport;
}

const modeSimulation = () => !process.env.SMTP_HOST;

// Échappe TOUTE valeur venant d'un utilisateur avant de la mettre dans le HTML
function echapper(valeur) {
  return String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const dt = (n) => `${Number(n).toFixed(2)} DT`;

// Cadre commun : mise en page sobre, styles en ligne (compatibles avec les clients mail)
function gabarit({ titre, intro, contenu }) {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2430;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e3e6ec;border-radius:8px;">
<tr><td style="padding:24px 28px;border-bottom:1px solid #e3e6ec;"><span style="font-size:22px;font-weight:bold;color:#2f5bea;">Boutique</span></td></tr>
<tr><td style="padding:24px 28px;">
<h1 style="margin:0 0 12px;font-size:20px;">${echapper(titre)}</h1>
<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475467;">${intro}</p>
${contenu}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e3e6ec;font-size:12px;color:#667085;">Cet email a été envoyé automatiquement, merci de ne pas y répondre.</td></tr>
</table></body></html>`;
}

function tableauLignes(lignes) {
  const l = lignes.map((x) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid #eef0f4;font-size:14px;">${echapper(x.produit_nom)}</td>
<td style="padding:8px 0;border-bottom:1px solid #eef0f4;font-size:14px;text-align:center;">${echapper(x.quantite)}</td>
<td style="padding:8px 0;border-bottom:1px solid #eef0f4;font-size:14px;text-align:right;">${echapper(dt(x.quantite * x.prix_unitaire))}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr><th align="left" style="font-size:12px;color:#667085;padding-bottom:6px;">Produit</th><th style="font-size:12px;color:#667085;padding-bottom:6px;">Qté</th><th align="right" style="font-size:12px;color:#667085;padding-bottom:6px;">Sous-total</th></tr>${l}</table>`;
}

function libellePaiement(c) {
  if (c.mode_paiement === 'carte') {
    return `Carte ${echapper(c.paiement_marque || '')} ****${echapper(c.paiement_last4 || '')} (${c.statut_paiement === 'rembourse' ? 'remboursé' : 'payé'})`;
  }
  return c.statut_paiement === 'paye' ? 'À la livraison (payé)' : 'À la livraison';
}

function bloqueRecap(c, lignes) {
  const adresse = [c.adresse_livraison, c.ville].filter(Boolean).join(', ');
  let totaux = '';
  if (Number(c.remise) > 0) {
    totaux += `<tr><td style="font-size:14px;color:#667085;padding:4px 0;">Sous-total</td><td align="right" style="font-size:14px;">${echapper(dt(Number(c.total) + Number(c.remise)))}</td></tr>
<tr><td style="font-size:14px;color:#667085;padding:4px 0;">Remise${c.code_promo ? ` (${echapper(c.code_promo)})` : ''}</td><td align="right" style="font-size:14px;">- ${echapper(dt(c.remise))}</td></tr>`;
  }
  totaux += `<tr><td style="font-size:16px;font-weight:bold;padding:8px 0;">Total</td><td align="right" style="font-size:16px;font-weight:bold;color:#2f5bea;">${echapper(dt(c.total))}</td></tr>`;
  return `${tableauLignes(lignes)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">${totaux}</table>
<p style="margin:0 0 6px;font-size:13px;color:#667085;">Paiement</p><p style="margin:0 0 12px;font-size:14px;">${libellePaiement(c)}</p>
${adresse ? `<p style="margin:0 0 6px;font-size:13px;color:#667085;">Adresse de livraison</p><p style="margin:0 0 12px;font-size:14px;">${echapper(adresse)}${c.telephone ? `<br>Tél : ${echapper(c.telephone)}` : ''}</p>` : ''}`;
}

const MESSAGES_STATUT = {
  confirmee: { sujet: (n) => `Commande n°${n} confirmée`, titre: 'Votre commande est confirmée', intro: 'Nous avons confirmé votre commande et la préparons.' },
  expediee: { sujet: (n) => `Commande n°${n} expédiée`, titre: 'Votre commande est en route', intro: 'Votre commande vient d\'être expédiée.' },
  livree: { sujet: (n) => `Commande n°${n} livrée`, titre: 'Votre commande est livrée', intro: 'Votre commande a été livrée. Nous espérons qu\'elle vous plaît !' },
};

// type : 'commande_confirmation' | 'commande_statut' | 'commande_annulation'
function construire(type, commande, lignes, statut) {
  const nom = echapper(commande.client_nom);
  const n = commande.id;
  if (type === 'commande_confirmation') {
    return {
      sujet: `Confirmation de votre commande n°${n}`,
      html: gabarit({
        titre: `Merci pour votre commande n°${n}`,
        intro: `Bonjour ${nom}, nous avons bien reçu votre commande. Voici le récapitulatif :`,
        contenu: bloqueRecap(commande, lignes),
      }),
    };
  }
  if (type === 'commande_annulation') {
    const rembourse = commande.statut_paiement === 'rembourse';
    return {
      sujet: `Commande n°${n} annulée`,
      html: gabarit({
        titre: `Votre commande n°${n} a été annulée`,
        intro: `Bonjour ${nom}, votre commande a été annulée.${rembourse ? ' Le montant payé par carte vous sera remboursé.' : ''}`,
        contenu: bloqueRecap(commande, lignes),
      }),
    };
  }
  const m = MESSAGES_STATUT[statut];
  return {
    sujet: m.sujet(n),
    html: gabarit({
      titre: `${m.titre} (n°${n})`,
      intro: `Bonjour ${nom}, ${m.intro.charAt(0).toLowerCase()}${m.intro.slice(1)}`,
      contenu: bloqueRecap(commande, lignes),
    }),
  };
}

// Envoie un email et l'enregistre toujours en base. Ne lance jamais d'exception. Retourne la ligne enregistrée.
async function envoyer({ destinataire, sujet, html, type, commande_id = null }) {
  let statut = 'simule';
  let erreur = null;
  try {
    const info = await obtenirTransport().sendMail({ from: EXPEDITEUR(), to: destinataire, subject: sujet, html });
    statut = modeSimulation() ? 'simule' : 'envoye';
    void info;
  } catch (err) {
    statut = 'echec';
    erreur = String((err && err.message) || err).slice(0, 500);
  }
  try {
    const [r] = await pool.query(
      'INSERT INTO emails (destinataire, sujet, corps_html, type, commande_id, statut, erreur) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [destinataire, sujet, html, type, commande_id, statut, erreur]
    );
    return { id: r.insertId, statut, erreur };
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error('[email] enregistrement impossible :', err && err.message);
    return { id: null, statut, erreur };
  }
}

async function chargerCommande(id) {
  const [rows] = await pool.query(
    `SELECT c.*, u.nom AS client_nom, u.email AS client_email
     FROM commandes c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
    [id]
  );
  if (!rows[0]) return null;
  const [lignes] = await pool.query(
    `SELECT p.nom AS produit_nom, l.quantite, l.prix_unitaire
     FROM lignes_commande l JOIN produits p ON p.id = l.produit_id WHERE l.commande_id = ? ORDER BY l.id`,
    [id]
  );
  return { commande: rows[0], lignes };
}

// Abonné du bus d'événements
async function traiterEvenement(evenement) {
  let type;
  let statut;
  if (evenement.type === 'commande.creee') type = 'commande_confirmation';
  else if (evenement.type === 'commande.annulee') type = 'commande_annulation';
  else if (evenement.type === 'commande.statut' && MESSAGES_STATUT[evenement.donnees.nouveau]) {
    type = 'commande_statut';
    statut = evenement.donnees.nouveau;
  } else return;

  const charge = await chargerCommande(evenement.donnees.id);
  if (!charge) return;
  const { sujet, html } = construire(type, charge.commande, charge.lignes, statut);
  await envoyer({ destinataire: charge.commande.client_email, sujet, html, type, commande_id: charge.commande.id });
}

// Renvoie un email déjà enregistré (nouvelle ligne dans l'historique)
async function renvoyer(email) {
  return envoyer({
    destinataire: email.destinataire, sujet: email.sujet, html: email.corps_html, type: email.type, commande_id: email.commande_id,
  });
}

module.exports = { envoyer, renvoyer, traiterEvenement, construire, echapper, modeSimulation };
