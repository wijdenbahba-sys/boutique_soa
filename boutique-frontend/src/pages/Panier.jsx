import { useState } from 'react';
import CarteApercu from '../components/CarteApercu.jsx';
import Confetti from '../components/Confetti.jsx';
import Icone from '../icons.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useCart } from '../CartContext.jsx';
import { api } from '../api.js';
import { useT } from '../i18n.jsx';
import { formaterPrix } from '../utils.js';

export default function Panier() {
  const { items, changerQuantite, retirer, vider, total } = useCart();
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [telephone, setTelephone] = useState('');
  const [codeSaisi, setCodeSaisi] = useState('');
  const [promo, setPromo] = useState(null); // { code, remise, total_apres } si le code est valide
  const [erreurPromo, setErreurPromo] = useState('');
  const [commande, setCommande] = useState(null); // la commande créée (pour l'affichage de confirmation)
  const [etape, setEtape] = useState(1); // 1 panier, 2 livraison, 3 paiement
  const [mode, setMode] = useState('carte'); // 'carte' ou 'livraison'
  const [carte, setCarte] = useState({ numero: '', titulaire: '', expiration: '', cvc: '' });
  const [verso, setVerso] = useState(false);
  const majCarte = (champ, valeur) => setCarte((c) => ({ ...c, [champ]: valeur }));
  // Formate pendant la saisie : "4242424242424242" -> "4242 4242 4242 4242", "1230" -> "12/30"
  const formaterNumero = (v) => (v.replace(/\D/g, '').slice(0, 19).match(/.{1,4}/g) || []).join(' ');
  const formaterExpiration = (v) => {
    const c = v.replace(/\D/g, '').slice(0, 4);
    return c.length > 2 ? `${c.slice(0, 2)}/${c.slice(2)}` : c;
  };
  const CARTES_TEST = [
    { numero: '4242 4242 4242 4242', cle: 'paiement.testOk' },
    { numero: '4000 0000 0000 0002', cle: 'paiement.testRefus' },
    { numero: '4000 0000 0000 9995', cle: 'paiement.testFonds' },
  ];
  const ETAPES = ['panier', 'livraison', 'paiement'];

  const remise = promo ? promo.remise : 0;
  const totalAPayer = Math.max(total - remise, 0);

  // Vérifie le code auprès de l'API (la remise définitive est recalculée par le serveur à la commande)
  async function appliquerCode(e) {
    e.preventDefault();
    setErreurPromo('');
    if (!user) {
      navigate('/login', { state: { from: '/panier', message: t('panier.connexionRequise') } });
      return;
    }
    try {
      const r = await api('/api/codes-promo/verifier', { method: 'POST', token, body: { code: codeSaisi.trim(), montant: total } });
      setPromo(r);
    } catch (err) {
      setPromo(null);
      setErreurPromo(err.message);
    }
  }

  function suivant() {
    setErreur('');
    if (etape === 1) {
      if (!user) { navigate('/login', { state: { from: '/panier', message: t('panier.connexionRequise') } }); return; }
      if (user.role === 'admin') { setErreur(t('panier.adminInterdit')); return; }
    }
    if (etape === 2 && (!adresse.trim() || !ville.trim() || !telephone.trim())) {
      setErreur(t('panier.livraisonObligatoire'));
      return;
    }
    setEtape((x) => Math.min(x + 1, 3));
  }

  async function valider(e) {
    e?.preventDefault();
    setErreur('');
    if (etape < 3) { suivant(); return; }

    // 1) Pas connecté : on envoie vers la connexion, puis on revient ici
    if (!user) {
      navigate('/login', { state: { from: '/panier', message: t('panier.connexionRequise') } });
      return;
    }
    // 2) Le backend refuse les commandes d'un admin : on prévient avant d'appeler l'API
    if (user.role === 'admin') {
      setErreur(t('panier.adminInterdit'));
      return;
    }

    if (!adresse.trim() || !ville.trim() || !telephone.trim()) {
      setErreur(t('panier.livraisonObligatoire'));
      return;
    }

    if (mode === 'carte' && (!carte.numero.trim() || !carte.titulaire.trim() || !carte.expiration.trim() || !carte.cvc.trim())) {
      setErreur(t('paiement.carteObligatoire'));
      return;
    }

    // 3) On envoie la commande au backend
    setEnvoi(true);
    try {
      const donnees = await api('/api/commandes', {
        method: 'POST',
        token,
        body: {
          produits: items.map((i) => ({ produit_id: i.produit_id, quantite: i.quantite })),
          code_promo: promo ? promo.code : undefined,
          adresse_livraison: adresse.trim(),
          ville: ville.trim(),
          telephone: telephone.trim(),
          mode_paiement: mode,
          carte: mode === 'carte' ? { numero: carte.numero, titulaire: carte.titulaire.trim(), expiration: carte.expiration, cvc: carte.cvc } : undefined,
        },
      });
      setCommande(donnees);
      setCarte({ numero: '', titulaire: '', expiration: '', cvc: '' }); // on n'a plus besoin des données de carte
      vider(); // la commande est enregistrée : le panier est vidé
    } catch (err) {
      if (err.status === 401) {
        // Le token JWT a expiré (il est valable 1 jour) : il faut se reconnecter
        logout();
        navigate('/login', { state: { from: '/panier', message: t('session.expiree') } });
        return;
      }
      setErreur(err.message); // ex : "Stock insuffisant pour ..."
    } finally {
      setEnvoi(false);
    }
  }

  // Écran de confirmation après une commande réussie
  if (commande) {
    return (
      <div className="card form-card center succes-commande">
        <Confetti />
        <span className="succes-coche" aria-hidden="true"><Icone nom="bouclier" taille={34} /></span>
        <h1>{t('panier.confirmee')}</h1>
        <p>
          {t('panier.commandeCreee', { id: commande.id })}
        </p>
        <p className="muted">{t('panier.statutAttente')}</p>
        {commande.paiement && (
          <p><span className="badge badge-ok">{t('paiement.paye')}</span> {commande.paiement.marque} •••• {commande.paiement.last4}</p>
        )}
        <p className="muted petit">{t('paiement.emailEnvoye')}</p>
        <p className="total">{t('commun.total')} : {formaterPrix(commande.total)}</p>
        <Link to="/commandes" className="btn btn-block">{t('panier.voirCommandes')}</Link>
        <Link to="/" className="btn btn-light btn-block">{t('commun.retourCatalogue')}</Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card center">
        <h1>{t('panier.vide')}</h1>
        <p><Link to="/">{t('panier.voirCatalogue')}</Link></p>
      </div>
    );
  }

  return (
    <>
      <h1>{t('panier.titre')}</h1>

      {/* Indicateur d'étapes : panier → livraison → paiement */}
      <ol className="stepper" aria-label={t('panier.titre')}>
        {ETAPES.map((cle, i) => (
          <li key={cle} className={i + 1 < etape ? 'fait' : i + 1 === etape ? 'courant' : ''} aria-current={i + 1 === etape ? 'step' : undefined}>
            <button type="button" disabled={i + 1 >= etape} onClick={() => setEtape(i + 1)}>
              <span className="stepper-rond">{i + 1 < etape ? '✓' : i + 1}</span>
              <span>{t(`etape.${cle}`)}</span>
            </button>
          </li>
        ))}
      </ol>

      <form className="panier-grille" onSubmit={valider}>
        <div>
          {etape === 1 && (
          <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('commun.produit')}</th>
                <th>{t('commun.prix')}</th>
                <th>{t('commun.quantite')}</th>
                <th>{t('commun.sousTotal')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.produit_id}>
                  <td><Link to={`/produit/${i.produit_id}`}>{i.nom}</Link></td>
                  <td>{formaterPrix(i.prix)}</td>
                  <td>
                    <div className="qte">
                      <button
                        type="button"
                        className="btn btn-light btn-small"
                        aria-label={t('panier.diminuer', { nom: i.nom })}
                        onClick={() => changerQuantite(i.produit_id, i.quantite - 1)}
                      >
                        −
                      </button>
                      <span className="qte-valeur">{i.quantite}</span>
                      <button
                        type="button"
                        className="btn btn-light btn-small"
                        aria-label={t('panier.augmenter', { nom: i.nom })}
                        disabled={i.quantite >= i.stock}
                        onClick={() => changerQuantite(i.produit_id, i.quantite + 1)}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td>{formaterPrix(i.prix * i.quantite)}</td>
                  <td>
                    <button type="button" className="btn btn-light btn-small" onClick={() => retirer(i.produit_id)}>{t('panier.retirer')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ padding: '0.4rem 0.5rem' }}>
            <button type="button" className="btn btn-light btn-small" onClick={vider}>{t('panier.vider')}</button>
          </p>
        </div>
          )}

          {etape === 2 && (
            <div className="card">
              <h2>{t('panier.livraison')}</h2>
              <div className="livraison">
                <label>{t('panier.adresse')}<input value={adresse} onChange={(e) => setAdresse(e.target.value)} maxLength={255} autoComplete="street-address" /></label>
                <label>{t('panier.ville')}<input value={ville} onChange={(e) => setVille(e.target.value)} maxLength={80} autoComplete="address-level2" /></label>
                <label>{t('panier.telephone')}<input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} maxLength={30} autoComplete="tel" /></label>
              </div>
            </div>
          )}

          {etape === 3 && (
            <div className="card">
              <h2>{t('paiement.titre')}</h2>
              <div className="choix-paiement" role="radiogroup" aria-label={t('paiement.titre')}>
                <label className={mode === 'carte' ? 'actif' : ''}>
                  <input type="radio" name="mode" checked={mode === 'carte'} onChange={() => setMode('carte')} />
                  <Icone nom="carte" /> <span>{t('paiement.carte')}</span>
                </label>
                <label className={mode === 'livraison' ? 'actif' : ''}>
                  <input type="radio" name="mode" checked={mode === 'livraison'} onChange={() => setMode('livraison')} />
                  <Icone nom="camion" /> <span>{t('paiement.livraison')}</span>
                </label>
              </div>

              {mode === 'carte' ? (
                <div className="paiement-carte">
                  <CarteApercu numero={carte.numero} titulaire={carte.titulaire} expiration={carte.expiration} cvc={carte.cvc} verso={verso} />
                  <div className="livraison">
                    <label>{t('paiement.numero')}
                      <input inputMode="numeric" autoComplete="cc-number" value={carte.numero} placeholder="4242 4242 4242 4242"
                        onChange={(e) => majCarte('numero', formaterNumero(e.target.value))} onFocus={() => setVerso(false)} />
                    </label>
                    <label>{t('paiement.titulaire')}
                      <input autoComplete="cc-name" value={carte.titulaire} maxLength={100} onChange={(e) => majCarte('titulaire', e.target.value)} onFocus={() => setVerso(false)} />
                    </label>
                    <div className="deux-champs">
                      <label>{t('paiement.expire')}
                        <input inputMode="numeric" autoComplete="cc-exp" value={carte.expiration} placeholder="MM/AA"
                          onChange={(e) => majCarte('expiration', formaterExpiration(e.target.value))} onFocus={() => setVerso(false)} />
                      </label>
                      <label>CVC
                        <input inputMode="numeric" autoComplete="cc-csc" value={carte.cvc} maxLength={4} placeholder="123"
                          onChange={(e) => majCarte('cvc', e.target.value.replace(/\D/g, ''))} onFocus={() => setVerso(true)} onBlur={() => setVerso(false)} />
                      </label>
                    </div>
                    <p className="muted petit">{t('paiement.simule')}</p>
                    <div className="cartes-test">
                      {CARTES_TEST.map((c) => (
                        <button type="button" key={c.numero} className="btn btn-light btn-small"
                          onClick={() => setCarte((x) => ({ numero: c.numero, titulaire: x.titulaire || 'Client Test', expiration: x.expiration || '12/30', cvc: x.cvc || '123' }))}>
                          {t(c.cle)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="muted">{t('paiement.livraisonTexte')}</p>
              )}
            </div>
          )}
        </div>

        <aside className="card recap">
          <h2>{t('panier.codePromo')}</h2>
          <div className="promo-ligne">
            <input
              value={codeSaisi}
              onChange={(e) => { setCodeSaisi(e.target.value); setPromo(null); setErreurPromo(''); }}
              placeholder="BIENVENUE10"
              aria-label={t('panier.codePromo')}
            />
            <button type="button" className="btn btn-light" onClick={appliquerCode} disabled={!codeSaisi.trim()}>{t('panier.appliquer')}</button>
          </div>
          {promo && <p className="succes" style={{ margin: 0 }}>{t('panier.codeApplique', { code: promo.code })}</p>}
          {erreurPromo && <p className="erreur">{erreurPromo}</p>}

          <div className="recap-ligne"><span>{t('panier.sousTotal')}</span><span>{formaterPrix(total)}</span></div>
          {remise > 0 && <div className="recap-ligne remise"><span>{t('panier.remise')}</span><span>− {formaterPrix(remise)}</span></div>}
          <div className="recap-ligne recap-total"><span>{t('commun.total')}</span><span>{formaterPrix(totalAPayer)}</span></div>

          {erreur && <p className="erreur">{erreur}</p>}
          <button className="btn btn-block" disabled={envoi}>
            {etape < 3 ? t('etape.continuer') : envoi ? t('panier.envoi') : mode === 'carte' ? t('paiement.payer', { montant: formaterPrix(totalAPayer) }) : t('panier.valider')}
          </button>
          {etape > 1 && !envoi && (
            <button type="button" className="btn btn-light btn-block" onClick={() => { setErreur(''); setEtape(etape - 1); }}>{t('etape.retour')}</button>
          )}
        </aside>
      </form>
    </>
  );
}
