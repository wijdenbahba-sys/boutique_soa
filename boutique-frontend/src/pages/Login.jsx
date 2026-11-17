import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useT } from '../i18n.jsx';

export default function Login() {
  const { login } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  // Si on vient de la page Panier, on y retourne après la connexion
  const retour = location.state?.from || '/';
  const info = location.state?.message;

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  async function soumettre(e) {
    e.preventDefault(); // empêche le rechargement de la page
    setErreur('');
    setChargement(true);
    try {
      const utilisateur = await login(email, motDePasse);
      // Un admin qui se connecte sans page de retour précise arrive sur l'administration
      navigate(utilisateur.role === 'admin' && retour === '/' ? '/admin' : retour);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="card form-card">
      <h1>{t('login.titre')}</h1>
      {info && <p className="info">{info}</p>}
      <form onSubmit={soumettre}>
        <label>
          {t('commun.email')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          {t('commun.motDePasse')}
          <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
        </label>
        {erreur && <p className="erreur">{erreur}</p>}
        <button className="btn btn-block" disabled={chargement}>
          {chargement ? t('login.enCours') : t('login.bouton')}
        </button>
      </form>
      <p className="muted center">
        {t('login.pasDeCompte')}{' '}
        <Link to="/register" state={{ from: retour }}>{t('login.creer')}</Link>
      </p>
    </div>
  );
}
