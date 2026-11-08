import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const retour = location.state?.from || '/'; // page où retourner après l'inscription

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');

    // Même règle que le backend : 6 caractères minimum
    if (motDePasse.length < 6) {
      setErreur('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setChargement(true);
    try {
      await register(nom, email, motDePasse);
      navigate(retour);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="card form-card">
      <h1>Créer un compte</h1>
      <form onSubmit={soumettre}>
        <label>
          Nom
          <input value={nom} onChange={(e) => setNom(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Mot de passe (6 caractères minimum)
          <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
        </label>
        {erreur && <p className="erreur">{erreur}</p>}
        <button className="btn btn-block" disabled={chargement}>
          {chargement ? 'Création...' : "S'inscrire"}
        </button>
      </form>
      <p className="muted center">
        Déjà un compte ? <Link to="/login" state={{ from: retour }}>Se connecter</Link>
      </p>
    </div>
  );
}
