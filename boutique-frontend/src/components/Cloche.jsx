import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEvenements, decrire, ICONES_EVENEMENT } from '../Evenements.jsx';
import { useT } from '../i18n.jsx';
import Icone from '../icons.jsx';
import { formaterDate } from '../utils.js';

// Cloche de notifications de l'administrateur (temps réel)
export default function Cloche() {
  const { evenements, nonLus, connecte, marquerLus } = useEvenements();
  const { t } = useT();
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = (e) => { if (!racine.current?.contains(e.target)) setOuvert(false); };
    const echap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', echap);
    return () => { document.removeEventListener('mousedown', fermer); document.removeEventListener('keydown', echap); };
  }, [ouvert]);

  return (
    <div className="cloche" ref={racine}>
      <button
        type="button"
        className="btn btn-light btn-icone"
        aria-label={t('cloche.titre')}
        aria-expanded={ouvert}
        title={connecte ? t('cloche.enDirect') : t('cloche.hors')}
        onClick={() => { setOuvert((o) => !o); marquerLus(); }}
      >
        <Icone nom="cloche" taille={18} />
        {nonLus > 0 && <span className="cloche-pastille">{nonLus > 9 ? '9+' : nonLus}</span>}
        <span className={`cloche-point ${connecte ? 'en-ligne' : ''}`} aria-hidden="true" />
      </button>
      {ouvert && (
        <div className="cloche-panneau card" role="dialog" aria-label={t('cloche.titre')}>
          <div className="cloche-entete">
            <strong>{t('cloche.titre')}</strong>
            <span className={`badge ${connecte ? 'badge-ok' : 'badge-faible'}`}>{connecte ? t('cloche.enDirect') : t('cloche.hors')}</span>
          </div>
          {evenements.length === 0 ? (
            <p className="muted petit">{t('cloche.vide')}</p>
          ) : (
            <ul className="flux">
              {evenements.slice(0, 8).map((ev) => (
                <li key={ev.id}>
                  <Icone nom={ICONES_EVENEMENT[ev.type] || 'cloche'} taille={16} />
                  <div>
                    <div>{decrire(ev, t)}</div>
                    <div className="muted petit">{formaterDate(ev.date)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin" className="btn btn-light btn-small" onClick={() => setOuvert(false)}>{t('cloche.voirTout')}</Link>
        </div>
      )}
    </div>
  );
}
