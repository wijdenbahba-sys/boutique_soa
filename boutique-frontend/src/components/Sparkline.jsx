// Mini-courbe sans axes (tendance) : un simple tracé SVG, pas besoin d'une bibliothèque.
export default function Sparkline({ valeurs, largeur = 110, hauteur = 34, titre }) {
  if (!valeurs || valeurs.length < 2) return null;
  const max = Math.max(...valeurs, 1);
  const pas = largeur / (valeurs.length - 1);
  const points = valeurs.map((v, i) => [i * pas, hauteur - 3 - (v / max) * (hauteur - 8)]);
  const ligne = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const dernier = points[points.length - 1];
  return (
    <svg className="sparkline" width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={titre}>
      <path d={`${ligne} L${largeur} ${hauteur} L0 ${hauteur} Z`} className="spark-aire" />
      <path d={ligne} className="spark-ligne" />
      <circle cx={dernier[0]} cy={dernier[1]} r="2.8" className="spark-point" />
    </svg>
  );
}
