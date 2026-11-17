// Exécuté avant chaque fichier de test : l'API utilise une base SÉPARÉE, jamais boutique_db
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'boutique_test';
process.env.JWT_SECRET = 'secret_pour_les_tests';
process.env.JWT_EXPIRES_IN = '1h';
