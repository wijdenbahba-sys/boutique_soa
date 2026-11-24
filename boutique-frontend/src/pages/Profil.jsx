import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api.js';
import { useT } from '../i18n.jsx';

export default function Profil() {
  const { user, token, majUtilisateur } = useAuth();
  const { t } = useT();
  const [nom, setNom] = useState(user?.nom || '');
  const [email, setEmail] = useState(user?.email || '');
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [msgProfil, setMsgProfil] = useState({ type: '', texte: '' });
  const [msgMdp, setMsgMdp] = useState({ type: '', texte: '' });

  if (!user) return <Navigate to="/login" replace state={{ from: '/profil', message: t('panier.connexionRequise') }} />;

  async function enregistrerProfil(e) {
    e.preventDefault();
    setMsgProfil({ type: '', texte: '' });
    try {
      const r = await api('/api/auth/profil', { method: 'PUT', token, body: { nom, email } });
      majUtilisateur({ ...user, ...r.user });
      setMsgProfil({ type: 'succes', texte: t('profil.enregistre') });
    } catch (err) {
      setMsgProfil({ type: 'erreur', texte: err.message });
    }
  }

  async function changerMotDePasse(e) {
    e.preventDefault();
    setMsgMdp({ type: '', texte: '' });
    try {
      await api('/api/auth/mot-de-passe', { method: 'PUT', token, body: { ancien, nouveau } });
      setAncien(''); setNouveau('');
      setMsgMdp({ type: 'succes', texte: t('profil.mdpChange') });
    } catch (err) {
      setMsgMdp({ type: 'erreur', texte: err.message });
    }
  }

  return (
    <>
      <h1>{t('profil.titre')}</h1>
      <div className="profil-grille">
        <section className="card">
          <h2>{t('profil.infos')}</h2>
          <form onSubmit={enregistrerProfil}>
            <label>{t('commun.nom')}<input value={nom} onChange={(e) => setNom(e.target.value)} required /></label>
            <label>{t('commun.email')}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            {msgProfil.texte && <p className={msgProfil.type}>{msgProfil.texte}</p>}
            <button className="btn">{t('commun.enregistrer')}</button>
          </form>
        </section>
        <section className="card">
          <h2>{t('profil.mdp')}</h2>
          <form onSubmit={changerMotDePasse}>
            <label>{t('profil.ancienMdp')}<input type="password" value={ancien} onChange={(e) => setAncien(e.target.value)} required autoComplete="current-password" /></label>
            <label>{t('profil.nouveauMdp')}<input type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} required minLength={6} autoComplete="new-password" /></label>
            {msgMdp.texte && <p className={msgMdp.type}>{msgMdp.texte}</p>}
            <button className="btn">{t('profil.changer')}</button>
          </form>
        </section>
      </div>
    </>
  );
}
