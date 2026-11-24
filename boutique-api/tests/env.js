// Exécuté avant chaque fichier de test : l'API utilise une base SÉPARÉE, jamais boutique_db
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'boutique_test';
process.env.JWT_SECRET = 'secret_pour_les_tests';
process.env.JWT_EXPIRES_IN = '1h';
// Les images envoyées pendant les tests vont dans un dossier temporaire (jamais dans ./uploads)
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), `boutique-uploads-${process.pid}`);
// v4 : pas d'attente entre les tentatives de webhook, pas de SMTP (les emails sont simulés)
process.env.WEBHOOK_BACKOFF_MS = '5';
delete process.env.SMTP_HOST;
