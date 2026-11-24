import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api.js';
import { useT } from '../i18n.jsx';
import BoutonFacture from '../components/BoutonFacture.jsx';
import { STATUTS, formaterDate, formaterPrix } from '../utils.js';

// Page réservée aux clients : historique de leurs commandes
// Étapes du suivi d'une commande (hors annulation)
const ETAPES = ['en_attente', 'confirmee', 'expediee', 'livree'];
const CLASSES_PAIEMENT = { paye: 'badge-ok', en_attente: 'badge-faible', rembourse: 'badge-info', echoue: 'badge-rupture' };

export default function MesCommandes() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();
  const [commandes, setCommandes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [ouverte, setOuverte] = useState(null); // id de la commande dont le détail est affiché
  const [details, setDetails] = useState({}); // détails déjà chargés : { idCommande: { lignes: [...] } }

  const estClient = user?.role === 'client';

  // Session expirée (token JWT valable 1 jour) : on se déconnecte et on renvoie vers la connexion
  function sessionExpiree() {
    logout();
    navigate('/login', { state: { from: '/commandes', message: t('session.expiree') } });
  }

  // Chargement de la liste au démarrage de la page
  useEffect(() => {
    if (!estClient) return;
    let annule = false;
    api('/api/commandes/mes-commandes', { token })
      .then((data) => { if (!annule) setCommandes(data); })
      .catch((err) => {
        if (annule) return;
        if (err.status === 401) sessionExpiree();
        else setErreur(err.message);
      })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estClient, token]);

  // Afficher / masquer le détail (les lignes sont chargées une seule fois)
  async function basculerDetail(id) {
    if (ouverte === id) {
      setOuverte(null);
      return;
    }
    setOuverte(id);
    if (details[id]) return;
    try {
      const data = await api(`/api/commandes/${id}`, { token });
      setDetails((courant) => ({ ...courant, [id]: data }));
    } catch (err) {
      if (err.status === 401) sessionExpiree();
      else setErreur(err.message);
    }
  }

  async function annuler(id) {
    if (!window.confirm(t('commandes.confirmerAnnuler', { id }))) return;
    setErreur('');
    setSucces('');
    try {
      await api(`/api/commandes/${id}/annuler`, { method: 'PATCH', token });
      // On met à jour la liste localement : pas besoin de tout recharger
      setCommandes((courant) => courant.map((c) => (c.id === id ? { ...c, statut: 'annulee', statut_paiement: c.statut_paiement === 'paye' ? 'rembourse' : c.statut_paiement } : c)));
      setSucces(t('commandes.annulee', { id }));
    } catch (err) {
      if (err.status === 401) sessionExpiree();
      else setErreur(err.message);
    }
  }

  // Pas connecté : retour vers la connexion, puis on revient ici
  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/commandes', message: t('commandes.connexionRequise') }} />;
  }
  if (!estClient) {
    return (
      <div className="card center">
        <h1>{t('commandes.titre')}</h1>
        <p className="muted">{t('commandes.reserveClients')}</p>
      </div>
    );
  }

  return (
    <>
      <h1>{t('commandes.titre')}</h1>
      {erreur && <p className="erreur">{erreur}</p>}
      {succes && <p className="succes">{succes}</p>}
      {chargement && !erreur && <p className="muted">{t('commun.chargement')}</p>}
      {!chargement && !erreur && commandes.length === 0 && (
        <div className="card center">
          <p>{t('commandes.aucune')}</p>
          <p><Link to="/">{t('panier.voirCatalogue')}</Link></p>
        </div>
      )}

      <div className="commandes">
        {commandes.map((c) => {
          const statut = { texte: t(`statut.${c.statut}`), classe: STATUTS[c.statut]?.classe || '' };
          const annulable = c.statut === 'en_attente' || c.statut === 'confirmee';
          const detail = details[c.id];
          return (
            <article key={c.id} className="card">
              <div className="commande-tete">
                <h3>{t('commandes.numero', { id: c.id })}</h3>
                <span className={`badge ${statut.classe}`}>{statut.texte}</span>
                <span className={`badge ${CLASSES_PAIEMENT[c.statut_paiement] || ''}`} title={c.mode_paiement === 'carte' ? `${c.paiement_marque || ''} •••• ${c.paiement_last4 || ''}` : t('paiement.livraison')}>
                  {t(`paiement.statut.${c.statut_paiement}`)}
                </span>
                <span className="muted">{formaterDate(c.date_commande)}</span>
                <strong className="commande-total">{formaterPrix(c.total)}</strong>
              </div>

              {c.statut === 'annulee' ? null : (
                <ol className="timeline" aria-label={t('commandes.suivi')}>
                  {ETAPES.map((etape, i) => (
                    <li key={etape} className={i < ETAPES.indexOf(c.statut) ? 'fait' : i === ETAPES.indexOf(c.statut) ? 'fait courant' : ''}>
                      {t(`statut.${etape}`)}
                    </li>
                  ))}
                </ol>
              )}

              {ouverte === c.id && (
                <div className="commande-lignes table-wrap">
                  {!detail ? (
                    <p className="muted">{t('commun.chargementDetail')}</p>
                  ) : (
                    <table>
                      <thead>
                        <tr><th>{t('commun.produit')}</th><th>{t('commun.quantite')}</th><th>{t('commun.prixUnitaire')}</th><th>{t('commun.sousTotal')}</th></tr>
                      </thead>
                      <tbody>
                        {detail.lignes.map((l) => (
                          <tr key={l.id}>
                            <td>{l.produit_nom}</td>
                            <td>{l.quantite}</td>
                            <td>{formaterPrix(l.prix_unitaire)}</td>
                            <td>{formaterPrix(l.sous_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {detail && (Number(detail.remise) > 0 || detail.adresse_livraison) && (
                    <div className="livraison-info">
                      {Number(detail.remise) > 0 && (
                        <span>{t('commandes.promo', { code: detail.code_promo || '', montant: formaterPrix(detail.remise) })}</span>
                      )}
                      {detail.adresse_livraison && (
                        <span>{t('commandes.livreA', { adresse: [detail.adresse_livraison, detail.ville].filter(Boolean).join(', ') })}</span>
                      )}
                      {detail.telephone && <span>{t('commandes.tel', { tel: detail.telephone })}</span>}
                    </div>
                  )}
                </div>
              )}

              <div className="commande-actions">
                <button className="btn btn-light btn-small" onClick={() => basculerDetail(c.id)}>
                  {ouverte === c.id ? t('commandes.masquerDetail') : t('commandes.voirDetail')}
                </button>
                {c.statut !== 'annulee' && <BoutonFacture commandeId={c.id} />}
                {annulable && (
                  <button className="btn btn-light btn-small" onClick={() => annuler(c.id)}>{t('commandes.annuler')}</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
