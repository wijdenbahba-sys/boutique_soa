const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const { verifierToken, autoriser } = require('../../middleware/auth');
const { creerLimiteur } = require('../../middleware/limiteurs');

// Faux objets Express pour tester le middleware seul, sans serveur ni base de données
function fausseReponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('verifierToken', () => {
  test('401 sans en-tête Authorization', () => {
    const res = fausseReponse();
    const next = jest.fn();
    verifierToken({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('401 avec un token falsifié', () => {
    const res = fausseReponse();
    verifierToken({ headers: { authorization: 'Bearer faux.token.ici' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 avec un token expiré', () => {
    const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = fausseReponse();
    verifierToken({ headers: { authorization: `Bearer ${token}` } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("un bon token remplit req.user et appelle next()", () => {
    const token = jwt.sign({ id: 7, role: 'client' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    verifierToken(req, fausseReponse(), next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 7, role: 'client' });
  });
});

describe('autoriser', () => {
  test('403 si le rôle ne correspond pas', () => {
    const res = fausseReponse();
    const next = jest.fn();
    autoriser('admin')({ user: { role: 'client' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('next() si le rôle est autorisé', () => {
    const next = jest.fn();
    autoriser('admin', 'client')({ user: { role: 'client' } }, fausseReponse(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('Limiteur de débit', () => {
  test('répond 429 une fois la limite dépassée', async () => {
    process.env.TEST_RATE_LIMIT = '1'; // active la limitation, désactivée par défaut pendant les tests
    const app = express();
    app.use(creerLimiteur({ windowMs: 60000, limit: 3, message: 'stop' }));
    app.get('/', (req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/')).status).toBe(200);
    }
    const res = await request(app).get('/');
    expect(res.status).toBe(429);
    expect(res.body.message).toBe('stop');
    delete process.env.TEST_RATE_LIMIT;
  });
});
