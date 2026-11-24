import { useEffect, useRef } from 'react';

// Pluie de confettis (zellige : bleu, jasmin, harissa, vert) pour célébrer une commande.
// Désactivée si l'utilisateur a demandé moins d'animations (prefers-reduced-motion).
const COULEURS = ['#1f46d8', '#ffc83d', '#e23d3d', '#0f7d58', '#7b97ff'];

export default function Confetti({ duree = 2800 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    let largeur = (canvas.width = window.innerWidth);
    let hauteur = (canvas.height = window.innerHeight);
    const onResize = () => { largeur = canvas.width = window.innerWidth; hauteur = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);

    const pieces = Array.from({ length: 140 }, () => ({
      x: largeur / 2 + (Math.random() - 0.5) * 120,
      y: hauteur * 0.35,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 12 - 4,
      taille: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.35,
      couleur: COULEURS[Math.floor(Math.random() * COULEURS.length)],
      losange: Math.random() < 0.5,
    }));

    const debut = performance.now();
    let id;
    const image = (maintenant) => {
      const ecoule = maintenant - debut;
      ctx.clearRect(0, 0, largeur, hauteur);
      const alpha = Math.max(0, 1 - Math.max(0, ecoule - duree + 700) / 700);
      ctx.globalAlpha = alpha;
      for (const p of pieces) {
        p.vy += 0.32; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.couleur;
        if (p.losange) { ctx.rotate(Math.PI / 4); ctx.fillRect(-p.taille / 2, -p.taille / 2, p.taille, p.taille); }
        else ctx.fillRect(-p.taille / 2, -p.taille / 4, p.taille, p.taille / 2);
        ctx.restore();
      }
      if (ecoule < duree) id = requestAnimationFrame(image);
      else ctx.clearRect(0, 0, largeur, hauteur);
    };
    id = requestAnimationFrame(image);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', onResize); };
  }, [duree]);

  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
