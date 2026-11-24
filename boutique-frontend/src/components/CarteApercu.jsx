import { useT } from '../i18n.jsx';

// Aperçu animé de la carte bancaire : se remplit pendant la saisie et se retourne quand on tape le CVC.
// Rien n'est envoyé ni stocké ici : c'est uniquement un affichage.
export default function CarteApercu({ numero, titulaire, expiration, cvc, verso }) {
  const { t } = useT();
  const chiffres = numero.replace(/\D/g, '');
  const marque = /^4/.test(chiffres) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(chiffres) ? 'Mastercard' : '';
  const affiche = (chiffres.padEnd(16, '•').match(/.{1,4}/g) || []).join(' ');
  return (
    <div className={`carte-bancaire ${verso ? 'verso' : ''}`} aria-hidden="true">
      <div className="carte-face carte-recto">
        <div className="carte-haut">
          <span className="carte-puce" />
          <span className="carte-marque">{marque}</span>
        </div>
        <div className="carte-numero">{affiche}</div>
        <div className="carte-bas">
          <div>
            <small>{t('paiement.titulaire')}</small>
            <div>{titulaire.trim() || 'NOM PRÉNOM'}</div>
          </div>
          <div>
            <small>{t('paiement.expire')}</small>
            <div>{expiration || 'MM/AA'}</div>
          </div>
        </div>
      </div>
      <div className="carte-face carte-verso">
        <div className="carte-bande" />
        <div className="carte-cvc"><small>CVC</small><span>{cvc ? cvc.replace(/./g, '•') : '•••'}</span></div>
      </div>
    </div>
  );
}
