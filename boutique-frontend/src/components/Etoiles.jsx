import Icone from '../icons.jsx';

// Affiche une note sur 5 : ★★★★☆ 4.2 (12)
export default function Etoiles({ note, nb, taille = 15 }) {
  const arrondie = Math.round(Number(note) || 0);
  return (
    <span className="etoiles" aria-label={note ? `${note} / 5` : ''}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= arrondie ? '' : 'vide'}><Icone nom="etoile" taille={taille} /></span>
      ))}
      {nb !== undefined && <span className="texte">{note ? `${Number(note).toFixed(1)} (${nb})` : ''}</span>}
    </span>
  );
}
