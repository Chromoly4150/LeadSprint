const { runMigrations } = require('../src/db');

runMigrations();
console.log('Database initialized and migrations applied.');
