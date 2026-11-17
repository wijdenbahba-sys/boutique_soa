import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../useApi.js';
import { useT } from '../i18n.jsx';
import { formaterPrix } from '../utils.js';

const COULEUR = '#2f5bea';
const COULEUR_GRILLE = '#e3e6ec';
const COULEUR_TEXTE = '#667085';

// Chiffre d'affaires par catégorie : GET /api/stats/par-categorie
// Barres horizontales, triées (la plus grande en haut), une seule couleur : la longueur porte l'information.
export default function ChartCategories() {
  const appeler = useApi();
  const { t } = useT();
  const [donnees, setDonnees] = useState(null);
  const [tableau, setTableau] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let annule = false;
    appeler('/api/stats/par-categorie')
      .then((d) => { if (!annule) setDonnees(d); })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); });
    return () => { annule = true; };
  }, [appeler]);

  return (
    <section className="card" aria-labelledby="titre-categories">
      <div className="entete-section">
        <div>
          <h2 id="titre-categories">{t('dashboard.categories.titre')}</h2>
          <p className="muted petit">{t('dashboard.categories.sousTitre')}</p>
        </div>
        {donnees && donnees.length > 0 && (
          <button className="btn btn-light btn-small" onClick={() => setTableau((v) => !v)} aria-pressed={tableau}>
            {tableau ? t('dashboard.graphique') : t('dashboard.tableau')}
          </button>
        )}
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {!donnees && !erreur && <p className="muted">{t('commun.chargement')}</p>}
      {donnees && donnees.length === 0 && <p className="muted">{t('dashboard.categories.aucune')}</p>}

      {donnees && donnees.length > 0 && !tableau && (
        <div dir="ltr" className="graphique" role="img" aria-label={t('dashboard.categories.titre')}>
          <ResponsiveContainer width="100%" height={Math.max(150, donnees.length * 46 + 30)}>
            <BarChart data={donnees} layout="vertical" margin={{ top: 4, right: 84, bottom: 4, left: 4 }} barCategoryGap={12}>
              <CartesianGrid horizontal={false} stroke={COULEUR_GRILLE} strokeWidth={1} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="categorie"
                width={104}
                tick={{ fill: '#1f2430', fontSize: 13 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(47, 91, 234, 0.06)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const c = payload[0].payload;
                  return (
                    <div className="infobulle">
                      <strong>{c.categorie}</strong>
                      <div><span className="pastille" style={{ background: COULEUR }} /> {formaterPrix(c.chiffre_affaires)}</div>
                      <div className="petit muted">{t('dashboard.categories.vendus', { n: c.quantite_vendue })}</div>
                    </div>
                  );
                }}
              />
              {/* 20 px d'épaisseur, extrémité arrondie (4 px), valeur au bout de la barre */}
              <Bar dataKey="chiffre_affaires" fill={COULEUR} barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="chiffre_affaires"
                  position="right"
                  formatter={(v) => formaterPrix(v)}
                  style={{ fill: '#1f2430', fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {donnees && donnees.length > 0 && tableau && (
        <div className="table-wrap tableau-court">
          <table>
            <thead>
              <tr><th>{t('commun.categorie')}</th><th>{t('dashboard.categories.quantite')}</th><th>{t('dashboard.ventes.ca')}</th></tr>
            </thead>
            <tbody>
              {donnees.map((c) => (
                <tr key={c.categorie}>
                  <td>{c.categorie}</td>
                  <td>{c.quantite_vendue}</td>
                  <td>{formaterPrix(c.chiffre_affaires)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
