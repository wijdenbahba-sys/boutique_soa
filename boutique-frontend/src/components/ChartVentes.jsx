import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../useApi.js';
import { useT } from '../i18n.jsx';
import { formaterDate, formaterPrix } from '../utils.js';

// Couleurs du graphique (une seule série : une seule couleur, celle de la marque)
const COULEUR = '#2f5bea';
const COULEUR_GRILLE = '#e3e6ec';
const COULEUR_TEXTE = '#667085';

// Évolution des ventes jour par jour : GET /api/stats/ventes?jours=30
// Une seule mesure à la fois (jamais deux axes verticaux) : on bascule entre CA et nombre de commandes.
export default function ChartVentes() {
  const appeler = useApi();
  const { t } = useT();
  const [jours, setJours] = useState(30);
  const [mesure, setMesure] = useState('chiffre_affaires'); // ou 'commandes'
  const [donnees, setDonnees] = useState(null);
  const [tableau, setTableau] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let annule = false;
    setDonnees(null);
    setErreur('');
    appeler(`/api/stats/ventes?jours=${jours}`)
      .then((d) => { if (!annule) setDonnees(d); })
      .catch((err) => { if (!annule && err.status !== 401) setErreur(err.message); });
    return () => { annule = true; };
  }, [appeler, jours]);

  const estCA = mesure === 'chiffre_affaires';
  const formaterValeur = (v) => (estCA ? formaterPrix(v) : String(v));
  const total = donnees ? donnees.reduce((s, j) => s + j[mesure], 0) : 0;
  const derniere = donnees?.[donnees.length - 1];

  return (
    <section className="card" aria-labelledby="titre-ventes">
      <div className="entete-section">
        <div>
          <h2 id="titre-ventes">{t('dashboard.ventes.titre')}</h2>
          <p className="muted petit">
            {estCA ? t('dashboard.ventes.sousTitreCA') : t('dashboard.ventes.sousTitreNb')}
            {donnees && ` · ${t('dashboard.ventes.total', { valeur: formaterValeur(total) })}`}
          </p>
        </div>
        <div className="outils-graphique">
          <div className="segmente" role="group" aria-label={t('dashboard.ventes.mesure')}>
            <button aria-pressed={estCA} onClick={() => setMesure('chiffre_affaires')}>{t('dashboard.ventes.ca')}</button>
            <button aria-pressed={!estCA} onClick={() => setMesure('commandes')}>{t('dashboard.ventes.commandes')}</button>
          </div>
          <div className="segmente" role="group" aria-label={t('dashboard.ventes.periode')}>
            {[7, 30, 90].map((j) => (
              <button key={j} aria-pressed={jours === j} onClick={() => setJours(j)}>{t('dashboard.ventes.jours', { n: j })}</button>
            ))}
          </div>
          <button className="btn btn-light btn-small" onClick={() => setTableau((v) => !v)} aria-pressed={tableau}>
            {tableau ? t('dashboard.graphique') : t('dashboard.tableau')}
          </button>
        </div>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}
      {!donnees && !erreur && <p className="muted">{t('commun.chargement')}</p>}

      {donnees && total === 0 && <p className="muted">{t('dashboard.ventes.aucune')}</p>}

      {donnees && total > 0 && !tableau && (
        // dir="ltr" : le temps s'écoule toujours de gauche à droite, même dans l'interface arabe
        <div dir="ltr" className="graphique" role="img" aria-label={t('dashboard.ventes.titre')}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={donnees} margin={{ top: 24, right: 28, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke={COULEUR_GRILLE} strokeWidth={1} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formaterDate(d, false).slice(0, 5)}
                tick={{ fill: COULEUR_TEXTE, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: COULEUR_GRILLE }}
                minTickGap={28}
              />
              <YAxis
                allowDecimals={false}
                width={48}
                tick={{ fill: COULEUR_TEXTE, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: COULEUR_TEXTE, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const j = payload[0].payload;
                  return (
                    <div className="infobulle">
                      <div className="petit muted">{formaterDate(j.date, false)}</div>
                      <div><span className="pastille" style={{ background: COULEUR }} /> <strong>{formaterValeur(j[mesure])}</strong></div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey={mesure}
                stroke={COULEUR}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={COULEUR}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 5, fill: COULEUR, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
              {/* Point final : la valeur la plus récente est étiquetée */}
              {derniere && (
                <ReferenceDot
                  x={derniere.date}
                  y={derniere[mesure]}
                  r={4}
                  fill={COULEUR}
                  stroke="#fff"
                  strokeWidth={2}
                  label={{ value: formaterValeur(derniere[mesure]), position: 'top', fill: '#1f2430', fontSize: 12 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {donnees && tableau && (
        <div className="table-wrap tableau-court">
          <table>
            <thead>
              <tr><th>{t('commun.date')}</th><th>{t('dashboard.ventes.commandes')}</th><th>{t('dashboard.ventes.ca')}</th></tr>
            </thead>
            <tbody>
              {[...donnees].reverse().map((j) => (
                <tr key={j.date}>
                  <td>{formaterDate(j.date, false)}</td>
                  <td>{j.commandes}</td>
                  <td>{formaterPrix(j.chiffre_affaires)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
