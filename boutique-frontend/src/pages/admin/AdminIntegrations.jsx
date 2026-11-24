import { Fragment, useCallback, useEffect, useState } from 'react';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import { useToast } from '../../Toasts.jsx';
import { API_URL } from '../../api.js';
import { formaterDate } from '../../utils.js';
import Icone from '../../icons.jsx';

const EVENEMENTS = ['commande.creee', 'commande.statut', 'commande.annulee', 'stock.bas', 'achat.recu', 'avis.cree'];

// Boîte à copier : montre une valeur secrète une seule fois (clé API, secret de webhook)
function SecretUneFois({ titre, valeur, onFermer }) {
  const { t } = useT();
  const { toast } = useToast();
  return (
    <div className="secret-box" role="alert">
      <strong>{titre}</strong>
      <code>{valeur}</code>
      <div className="actions-ligne">
        <button type="button" className="btn btn-small" onClick={() => navigator.clipboard?.writeText(valeur).then(() => toast(t('integrations.copie'), { type: 'succes' }))}>{t('integrations.copier')}</button>
        <button type="button" className="btn btn-light btn-small" onClick={onFermer}>{t('integrations.jaiCopie')}</button>
      </div>
      <span className="muted petit">{t('integrations.uneSeuleFois')}</span>
    </div>
  );
}

function ClesApi() {
  const appeler = useApi();
  const { t } = useT();
  const { toast } = useToast();
  const [cles, setCles] = useState(null);
  const [nom, setNom] = useState('');
  const [nouvelle, setNouvelle] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(() => {
    appeler('/api/cles-api').then(setCles).catch((e) => { if (e.status !== 401) setErreur(e.message); });
  }, [appeler]);
  useEffect(charger, [charger]);

  async function creer(e) {
    e.preventDefault();
    setErreur('');
    try {
      const r = await appeler('/api/cles-api', { method: 'POST', body: { nom: nom.trim() } });
      setNouvelle(r);
      setNom('');
      charger();
    } catch (err) { if (err.status !== 401) setErreur(err.message); }
  }
  async function basculer(c) {
    try {
      await appeler(`/api/cles-api/${c.id}`, { method: 'PUT', body: { actif: !c.actif } });
      charger();
    } catch (err) { if (err.status !== 401) setErreur(err.message); }
  }
  async function supprimer(c) {
    if (!window.confirm(t('integrations.confirmerCle', { nom: c.nom }))) return;
    try {
      await appeler(`/api/cles-api/${c.id}`, { method: 'DELETE' });
      toast(t('integrations.cleSupprimee'), { type: 'info' });
      charger();
    } catch (err) { if (err.status !== 401) setErreur(err.message); }
  }

  return (
    <section className="card section-espace">
      <div className="entete-section">
        <div>
          <h2>{t('integrations.cles')}</h2>
          <p className="muted petit">{t('integrations.clesAide')}</p>
        </div>
      </div>
      {erreur && <p className="erreur">{erreur}</p>}
      {nouvelle && <SecretUneFois titre={t('integrations.cleCreee', { nom: nouvelle.nom })} valeur={nouvelle.cle} onFermer={() => setNouvelle(null)} />}

      <form className="ligne-formulaire" onSubmit={creer}>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('integrations.nomCle')} aria-label={t('integrations.nomCle')} maxLength={100} required />
        <button className="btn"><Icone nom="cle" taille={16} />{t('integrations.creerCle')}</button>
      </form>

      {cles && cles.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('integrations.nom')}</th><th>{t('integrations.cle')}</th><th>{t('integrations.appels')}</th><th>{t('integrations.derniere')}</th><th>{t('commun.statut')}</th><th></th></tr></thead>
            <tbody>
              {cles.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.nom}</strong></td>
                  <td><code>{c.prefixe}…</code></td>
                  <td>{c.nb_appels}</td>
                  <td>{c.derniere_utilisation ? formaterDate(c.derniere_utilisation) : '—'}</td>
                  <td><span className={`badge ${c.actif ? 'badge-ok' : 'badge-rupture'}`}>{c.actif ? t('integrations.active') : t('integrations.desactivee')}</span></td>
                  <td>
                    <div className="actions-ligne">
                      <button className="btn btn-light btn-small" onClick={() => basculer(c)}>{c.actif ? t('promos.desactiver') : t('promos.activer')}</button>
                      <button className="btn btn-light btn-small btn-danger" onClick={() => supprimer(c)}>{t('commun.supprimer')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cles && cles.length === 0 && <p className="muted">{t('integrations.aucuneCle')}</p>}

      <details className="exemple">
        <summary>{t('integrations.exemple')}</summary>
        <pre>{`curl -H "X-API-Key: bk_live_..." \\\n  "${API_URL}/api/partenaire/produits?search=clavier&limit=5"`}</pre>
      </details>
    </section>
  );
}

function Webhooks() {
  const appeler = useApi();
  const { t } = useT();
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState(null);
  const [url, setUrl] = useState('');
  const [choix, setChoix] = useState(['*']);
  const [nouveau, setNouveau] = useState(null);
  const [ouvert, setOuvert] = useState(null);
  const [envois, setEnvois] = useState({});
  const [erreur, setErreur] = useState('');

  const charger = useCallback(() => {
    appeler('/api/webhooks').then(setWebhooks).catch((e) => { if (e.status !== 401) setErreur(e.message); });
  }, [appeler]);
  useEffect(charger, [charger]);

  const tous = choix.includes('*');
  function basculerEvenement(ev) {
    setChoix((c) => {
      const sans = c.filter((x) => x !== '*' && x !== ev);
      return c.includes(ev) ? sans : [...sans, ev];
    });
  }

  async function creer(e) {
    e.preventDefault();
    setErreur('');
    if (choix.length === 0) { setErreur(t('integrations.choisirEvenement')); return; }
    try {
      const r = await appeler('/api/webhooks', { method: 'POST', body: { url: url.trim(), evenements: choix, actif: true } });
      setNouveau(r);
      setUrl('');
      charger();
    } catch (err) { if (err.status !== 401) setErreur(err.message); }
  }
  async function tester(w) {
    try {
      const r = await appeler(`/api/webhooks/${w.id}/test`, { method: 'POST' });
      toast(r.succes ? t('integrations.testOk', { code: r.statut_http, ms: r.duree_ms }) : t('integrations.testEchec', { code: r.statut_http ?? '—' }), { type: r.succes ? 'succes' : 'alerte' });
      charger();
      if (ouvert === w.id) voirEnvois(w.id, true);
    } catch (err) { if (err.status !== 401) setErreur(err.message); }
  }
  async function basculer(w) {
    try {
      await appeler(`/api/webhooks/${w.id}`, { method: 'PUT', body: { url: w.url, evenements: w.evenements, actif: !w.actif } });
      charger();
    } catch (err) { if (err.status !== 401) setErreur(err.message); }
  }
  async function supprimer(w) {
    if (!window.confirm(t('integrations.confirmerWebhook', { url: w.url }))) return;
    try {
      await appeler(`/api/webhooks/${w.id}`, { method: 'DELETE' });
      charger();
    } catch (err) { if (err.status !== 401) setErreur(err.message); }
  }
  async function voirEnvois(id, forcer = false) {
    if (ouvert === id && !forcer) { setOuvert(null); return; }
    setOuvert(id);
    try {
      const l = await appeler(`/api/webhooks/${id}/livraisons`);
      setEnvois((e) => ({ ...e, [id]: l }));
    } catch (err) { if (err.status !== 401) setErreur(err.message); }
  }

  return (
    <section className="card section-espace">
      <div className="entete-section">
        <div>
          <h2>{t('integrations.webhooks')}</h2>
          <p className="muted petit">{t('integrations.webhooksAide')}</p>
        </div>
      </div>
      {erreur && <p className="erreur">{erreur}</p>}
      {nouveau && <SecretUneFois titre={t('integrations.secretWebhook')} valeur={nouveau.secret} onFermer={() => setNouveau(null)} />}

      <form className="webhook-form" onSubmit={creer}>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://exemple.tn/hook" aria-label="URL" required maxLength={500} />
        <fieldset>
          <legend className="petit muted">{t('integrations.evenements')}</legend>
          <label className="case"><input type="checkbox" checked={tous} onChange={() => setChoix(tous ? [] : ['*'])} /> {t('integrations.tous')}</label>
          {EVENEMENTS.map((ev) => (
            <label className="case" key={ev}>
              <input type="checkbox" checked={tous || choix.includes(ev)} disabled={tous} onChange={() => basculerEvenement(ev)} /> <code>{ev}</code>
            </label>
          ))}
        </fieldset>
        <button className="btn"><Icone nom="lien" taille={16} />{t('integrations.creerWebhook')}</button>
      </form>

      {webhooks && webhooks.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>URL</th><th>{t('integrations.evenements')}</th><th>{t('integrations.envois')}</th><th>{t('commun.statut')}</th><th></th></tr></thead>
            <tbody>
              {webhooks.map((w) => (
                <Fragment key={w.id}>
                  <tr>
                    <td className="url-cell"><code>{w.url}</code></td>
                    <td className="petit">{w.evenements.includes('*') ? t('integrations.tous') : w.evenements.join(', ')}</td>
                    <td>
                      {w.nb_envois}
                      {w.dernier_succes !== null && <span className={`badge ${w.dernier_succes ? 'badge-ok' : 'badge-rupture'}`} style={{ marginInlineStart: 6 }}>{w.dernier_succes ? 'OK' : t('integrations.echec')}</span>}
                    </td>
                    <td><span className={`badge ${w.actif ? 'badge-ok' : 'badge-faible'}`}>{w.actif ? t('integrations.active') : t('integrations.desactivee')}</span></td>
                    <td>
                      <div className="actions-ligne">
                        <button className="btn btn-light btn-small" onClick={() => tester(w)}><Icone nom="eclair" taille={14} />{t('integrations.tester')}</button>
                        <button className="btn btn-light btn-small" onClick={() => voirEnvois(w.id)}>{t('integrations.historique')}</button>
                        <button className="btn btn-light btn-small" onClick={() => basculer(w)}>{w.actif ? t('promos.desactiver') : t('promos.activer')}</button>
                        <button className="btn btn-light btn-small btn-danger" onClick={() => supprimer(w)}>{t('commun.supprimer')}</button>
                      </div>
                    </td>
                  </tr>
                  {ouvert === w.id && (
                    <tr className="ligne-detail">
                      <td colSpan="5">
                        {!envois[w.id] ? <span className="muted">{t('commun.chargement')}</span> : envois[w.id].length === 0 ? (
                          <span className="muted">{t('integrations.aucunEnvoi')}</span>
                        ) : (
                          <table className="commande-lignes">
                            <thead><tr><th>{t('commun.date')}</th><th>{t('integrations.evenement')}</th><th>HTTP</th><th>{t('integrations.tentative')}</th><th>ms</th></tr></thead>
                            <tbody>
                              {envois[w.id].map((l) => (
                                <tr key={l.id}>
                                  <td>{formaterDate(l.created_at)}</td>
                                  <td><code>{l.evenement}</code></td>
                                  <td><span className={`badge ${l.succes ? 'badge-ok' : 'badge-rupture'}`}>{l.statut_http ?? t('integrations.reseau')}</span></td>
                                  <td>{l.tentative}</td>
                                  <td>{l.duree_ms ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {webhooks && webhooks.length === 0 && <p className="muted">{t('integrations.aucunWebhook')}</p>}

      <details className="exemple">
        <summary>{t('integrations.verifier')}</summary>
        <pre>{`// Node.js : vérifier la signature d'un webhook
const crypto = require('crypto');
const attendu = crypto.createHmac('sha256', SECRET).update(corpsBrut).digest('hex');
const ok = attendu === req.headers['x-boutique-signature'];`}</pre>
      </details>
    </section>
  );
}

export default function AdminIntegrations() {
  const { t } = useT();
  return (
    <>
      <h1>{t('integrations.titre')}</h1>
      <p className="muted">{t('integrations.intro')}</p>
      <ClesApi />
      <Webhooks />
    </>
  );
}
