import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import { formaterDate, formaterPrix } from '../../utils.js';

const VIDE = { code: '', type: 'pourcentage', valeur: '', min_commande: '0', date_expiration: '', utilisations_max: '' };

// Gestion des codes promo : création, activation / désactivation, suppression
export default function AdminCodesPromo() {
  const appeler = useApi();
  const { t } = useT();
  const [codes, setCodes] = useState([]);
  const [champs, setChamps] = useState(VIDE);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(() => {
    appeler('/api/codes-promo')
      .then(setCodes)
      .catch((err) => { if (err.status !== 401) setErreur(err.message); })
      .finally(() => setChargement(false));
  }, [appeler]);

  useEffect(charger, [charger]);

  const modifier = (nom) => (e) => setChamps((c) => ({ ...c, [nom]: e.target.value }));

  async function creer(e) {
    e.preventDefault();
    setErreur(''); setSucces('');
    try {
      await appeler('/api/codes-promo', {
        method: 'POST',
        body: {
          code: champs.code.trim().toUpperCase(),
          type: champs.type,
          valeur: champs.valeur,
          min_commande: champs.min_commande || 0,
          date_expiration: champs.date_expiration || null,
          utilisations_max: champs.utilisations_max || null,
        },
      });
      setChamps(VIDE);
      setSucces(t('promos.cree'));
      charger();
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  async function basculer(c) {
    setErreur(''); setSucces('');
    try {
      await appeler(`/api/codes-promo/${c.id}`, {
        method: 'PUT',
        body: {
          code: c.code, type: c.type, valeur: c.valeur, min_commande: c.min_commande,
          date_expiration: c.date_expiration, utilisations_max: c.utilisations_max, actif: !c.actif,
        },
      });
      charger();
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  async function supprimer(c) {
    if (!window.confirm(t('promos.confirmerSuppression', { code: c.code }))) return;
    setErreur(''); setSucces('');
    try {
      await appeler(`/api/codes-promo/${c.id}`, { method: 'DELETE' });
      charger();
    } catch (err) {
      if (err.status !== 401) setErreur(err.message);
    }
  }

  const valeurTexte = (c) => (c.type === 'pourcentage' ? `${Number(c.valeur)} %` : formaterPrix(c.valeur));

  function etat(c) {
    if (!c.actif) return { classe: 'badge-rupture', texte: t('promos.inactif') };
    if (c.expire) return { classe: 'badge-faible', texte: t('promos.expire') };
    if (c.utilisations_max !== null && c.utilisations >= c.utilisations_max) return { classe: 'badge-faible', texte: t('promos.epuise') };
    return { classe: 'badge-ok', texte: t('promos.actif') };
  }

  return (
    <>
      <div className="entete-section">
        <div>
          <h1>{t('promos.titre')}</h1>
          <p className="muted petit">{t('promos.aide')}</p>
        </div>
      </div>

      <form className="card section-espace-bas" onSubmit={creer}>
        <h2>{t('promos.nouveau')}</h2>
        <div className="ajout-fournisseur">
          <label>{t('promos.code')}<input value={champs.code} onChange={modifier('code')} placeholder="ETE25" maxLength={40} required /></label>
          <label>
            {t('promos.type')}
            <select value={champs.type} onChange={modifier('type')}>
              <option value="pourcentage">{t('promos.pourcentage')}</option>
              <option value="montant">{t('promos.montant')}</option>
            </select>
          </label>
          <label>{t('promos.valeur')}<input type="number" min="0.01" step="0.01" value={champs.valeur} onChange={modifier('valeur')} required /></label>
          <label>{t('promos.minimum')}<input type="number" min="0" step="0.01" value={champs.min_commande} onChange={modifier('min_commande')} /></label>
          <label>{t('promos.expiration')}<input type="date" value={champs.date_expiration} onChange={modifier('date_expiration')} /></label>
          <label>{t('promos.limite')}<input type="number" min="1" step="1" value={champs.utilisations_max} onChange={modifier('utilisations_max')} placeholder={t('promos.illimite')} /></label>
          <button className="btn">{t('commun.ajouter')}</button>
        </div>
      </form>

      {erreur && <p className="erreur section-espace-bas">{erreur}</p>}
      {succes && <p className="succes">{succes}</p>}
      {chargement && <p className="muted">{t('commun.chargement')}</p>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('promos.code')}</th><th>{t('promos.reduction')}</th><th>{t('promos.minimum')}</th>
              <th>{t('promos.expiration')}</th><th>{t('promos.utilisations')}</th><th>{t('commun.statut')}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {!chargement && codes.length === 0 && <tr><td colSpan="7" className="muted">{t('promos.aucun')}</td></tr>}
            {codes.map((c) => {
              const e = etat(c);
              return (
                <tr key={c.id}>
                  <td className="code-promo">{c.code}</td>
                  <td>{valeurTexte(c)}</td>
                  <td>{Number(c.min_commande) > 0 ? formaterPrix(c.min_commande) : '—'}</td>
                  <td>{c.date_expiration ? formaterDate(`${c.date_expiration}T12:00:00`, false) : '—'}</td>
                  <td>{c.utilisations}{c.utilisations_max !== null ? ` / ${c.utilisations_max}` : ''}</td>
                  <td><span className={`badge ${e.classe}`}>{e.texte}</span></td>
                  <td>
                    <div className="actions-ligne">
                      <button className="btn btn-light btn-small" onClick={() => basculer(c)}>{c.actif ? t('promos.desactiver') : t('promos.activer')}</button>
                      <button className="btn btn-light btn-small btn-danger" onClick={() => supprimer(c)}>{t('commun.supprimer')}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
