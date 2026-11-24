// Génère docs/boutique-api.postman_collection.json à partir de la spec Swagger.
// Usage : node scripts/generer-postman.js
const fs = require('fs');
const path = require('path');
const spec = require('../docs/swagger');

const resoudre = (s) => (s && s.$ref ? spec.components.schemas[s.$ref.split('/').pop()] : s);
function exemple(schema) {
  schema = resoudre(schema);
  if (!schema) return undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.type === 'array') return [exemple(schema.items)];
  if (schema.type === 'object' || schema.properties) {
    const o = {};
    for (const [k, v] of Object.entries(schema.properties || {})) o[k] = exemple(v);
    return o;
  }
  if (schema.enum) return schema.enum[0];
  return { string: 'texte', integer: 1, number: 1, boolean: true }[schema.type];
}

const dossiers = {};
for (const [chemin, ops] of Object.entries(spec.paths)) {
  for (const [methode, op] of Object.entries(ops)) {
    const tag = (op.tags && op.tags[0]) || 'Divers';
    const url = '{{baseUrl}}' + chemin.replace(/\{(\w+)\}/g, ':$1');
    const parts = url.replace('{{baseUrl}}', '').split('/').filter(Boolean);
    const query = (op.parameters || []).filter((p) => p.in === 'query')
      .map((p) => ({ key: p.name, value: String(p.example ?? p.schema?.default ?? ''), disabled: true }));
    const variables = (op.parameters || []).filter((p) => p.in === 'path')
      .map((p) => ({ key: p.name, value: '1' }));
    const item = {
      name: `${methode.toUpperCase()} ${chemin} - ${op.summary || ''}`,
      request: {
        method: methode.toUpperCase(),
        header: [],
        url: { raw: url, host: ['{{baseUrl}}'], path: parts.map((p) => p.replace(/\{(\w+)\}/g, ':$1')), query, variable: variables },
        description: op.description || op.summary || '',
      },
    };
    const corps = op.requestBody?.content?.['application/json'];
    if (corps) {
      item.request.header.push({ key: 'Content-Type', value: 'application/json' });
      item.request.body = { mode: 'raw', raw: JSON.stringify(corps.example ?? exemple(corps.schema), null, 2), options: { raw: { language: 'json' } } };
    }
    // Routes partenaire : authentification par clé (X-API-Key) au lieu du token JWT
    if (op.security && op.security.some((x) => x.apiKeyAuth)) {
      item.request.auth = { type: 'noauth' };
      item.request.header.push({ key: 'X-API-Key', value: '{{apiKey}}' });
    }
    if (chemin === '/api/auth/login' || chemin === '/api/auth/register') {
      item.request.auth = { type: 'noauth' };
    }
    if (chemin === '/api/auth/login') {
      item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: [
        'if (pm.response.code === 200) {',
        "  pm.collectionVariables.set('token', pm.response.json().token);",
        '}',
        "pm.test('statut 200', () => pm.response.to.have.status(200));",
      ] } }];
    }
    (dossiers[tag] = dossiers[tag] || []).push(item);
  }
}

const collection = {
  info: {
    name: 'Boutique API - Gestion d\'inventaire',
    description: 'Exécuter d\'abord "POST /api/auth/login" : le token est stocké automatiquement dans la variable {{token}}. Pour les routes /api/partenaire : créer une clé dans l\'admin (Intégrations) puis la coller dans la variable {{apiKey}}.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'token', value: '' },
    { key: 'apiKey', value: 'bk_live_...' },
  ],
  item: Object.entries(dossiers).map(([name, item]) => ({ name, item })),
};
const sortie = path.join(__dirname, '..', 'docs', 'boutique-api.postman_collection.json');
fs.writeFileSync(sortie, JSON.stringify(collection, null, 2));
const n = Object.values(dossiers).reduce((a, d) => a + d.length, 0);
console.log(`${n} requêtes dans ${Object.keys(dossiers).length} dossiers -> ${sortie}`);
