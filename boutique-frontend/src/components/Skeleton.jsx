// Faux contenu gris qui "respire" pendant le chargement (plus agréable qu'un simple "Chargement...")
export function Skeleton({ largeur = '100%', hauteur = '1rem', rond = false, style }) {
  return <span className="skeleton" aria-hidden="true" style={{ width: largeur, height: hauteur, borderRadius: rond ? '50%' : undefined, ...style }} />;
}

export function SkeletonCartes({ n = 8 }) {
  return (
    <div className="grille" aria-busy="true">
      {Array.from({ length: n }, (_, i) => (
        <div className="card skeleton-carte" key={i}>
          <Skeleton hauteur="150px" style={{ borderRadius: 10 }} />
          <Skeleton largeur="70%" style={{ marginTop: 14 }} />
          <Skeleton largeur="40%" hauteur="0.8rem" style={{ marginTop: 10 }} />
          <Skeleton largeur="30%" hauteur="1.3rem" style={{ marginTop: 14 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableau({ lignes = 6, colonnes = 5 }) {
  return (
    <div className="card" aria-busy="true">
      {Array.from({ length: lignes }, (_, i) => (
        <div className="skeleton-ligne" key={i}>
          {Array.from({ length: colonnes }, (_, j) => <Skeleton key={j} hauteur="0.95rem" largeur={j === 0 ? '40px' : '100%'} />)}
        </div>
      ))}
    </div>
  );
}
