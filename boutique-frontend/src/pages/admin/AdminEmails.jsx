import { useEffect, useState, useCallback } from 'react';
import { useApi } from '../../useApi.js';
import { useT } from '../../i18n.jsx';
import { useToast } from '../../Toasts.jsx';
import Pagination from '../../components/Pagination.jsx';
import { SkeletonTableau } from '../../components/Skeleton.jsx';
import { formaterDate } from '../../utils.js';

const CLASSES = { envoye: 'badge-ok', simule: 'badge-info', echec: 'badge-rupture' };

// Boîte d'envoi des emails (confirmation de commande, changement de statut, annulation)
export default function AdminEmails() {
  const appeler = useApi();
  const { t } = useT();
  const { toast } = useToast();
  const [emails, setEmails] = useState([]);
  const [mode, setMode] = useState('simulation');
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [selection, setSelection] = useState(null); // email complet affiché dans l'aperçu

  const charger = useCallback(() => {
    appeler(`/api/emails?page=${page}&limit=12`)
      .then((r) => { setEmails(r.data); setPagination(r.pagination); setMode(r.mode); setErreur(''); })
      .catch((e) => { if (e.status !== 401) setErreur(e.message); })
      .finally(() => setChargement(false));
  }, [appeler, page]);
  useEffect(charger, [charger]);

  async function ouvrir(id) {
    try { setSelection(await appeler(`/api/emails/${id}`)); } catch (e) { if (e.status !== 401) setErreur(e.message); }
  }
  async function renvoyer(id) {
    try {
      await appeler(`/api/emails/${id}/renvoyer`, { method: 'POST' });
      toast(t('emails.renvoye'), { type: 'succes' });
      charger();
    } catch (e) { if (e.status !== 401) setErreur(e.message); }
  }

  return (
    <>
      <div className="entete-section">
        <div>
          <h1>{t('emails.titre')}</h1>
          <p className="muted petit">{mode === 'simulation' ? t('emails.modeSimulation') : t('emails.modeSmtp')}</p>
        </div>
        <span className={`badge ${mode === 'simulation' ? 'badge-faible' : 'badge-ok'}`}>{mode === 'simulation' ? t('emails.simulation') : 'SMTP'}</span>
      </div>
      {erreur && <p className="erreur">{erreur}</p>}

      <div className="emails-grille">
        <div>
          {chargement ? <SkeletonTableau colonnes={4} /> : (
            <div className="card table-wrap">
              <table>
                <thead><tr><th>{t('commun.date')}</th><th>{t('emails.destinataire')}</th><th>{t('emails.sujet')}</th><th>{t('commun.statut')}</th><th></th></tr></thead>
                <tbody>
                  {emails.length === 0 && <tr><td colSpan="5" className="muted">{t('emails.aucun')}</td></tr>}
                  {emails.map((m) => (
                    <tr key={m.id} className={selection?.id === m.id ? 'ligne-active' : ''}>
                      <td className="nowrap">{formaterDate(m.created_at)}</td>
                      <td className="petit">{m.destinataire}</td>
                      <td>{m.sujet}</td>
                      <td><span className={`badge ${CLASSES[m.statut]}`} title={m.erreur || ''}>{t(`emails.statut.${m.statut}`)}</span></td>
                      <td>
                        <div className="actions-ligne">
                          <button className="btn btn-light btn-small" onClick={() => ouvrir(m.id)}>{t('emails.apercu')}</button>
                          <button className="btn btn-light btn-small" onClick={() => renvoyer(m.id)}>{t('emails.renvoyer')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination pagination={pagination} onChange={setPage} />
        </div>

        <aside className="card apercu-mail">
          {!selection ? <p className="muted">{t('emails.choisir')}</p> : (
            <>
              <div className="petit muted">{selection.destinataire}</div>
              <strong>{selection.sujet}</strong>
              {/* sandbox sans "allow-scripts" : le HTML de l'email ne peut exécuter aucun script */}
              <iframe title={selection.sujet} sandbox="" srcDoc={selection.corps_html} />
            </>
          )}
        </aside>
      </div>
    </>
  );
}
