const { abonner, derniers } = require('../utils/evenements');

// GET /api/evenements   (admin) : les 50 derniers événements (flux d'activité)
exports.liste = (req, res) => res.json(derniers());

// GET /api/evenements/flux   (admin) : Server-Sent Events (temps réel).
// Le navigateur garde la connexion ouverte ; chaque événement est poussé au format SSE.
exports.flux = (req, res) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n: connecté\n\n');

  const desabonner = abonner((ev) => {
    res.write(`id: ${ev.id}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
  }, 'sse');
  // commentaire périodique : garde la connexion vivante derrière les proxys
  const battement = setInterval(() => res.write(': ping\n\n'), 25000);
  battement.unref();

  req.on('close', () => {
    clearInterval(battement);
    desabonner();
  });
};
