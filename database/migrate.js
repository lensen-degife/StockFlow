const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log(`Running migration: ${file}`);
    try {
      await db.query(sql);
      console.log(`  ✓ ${file} applied successfully`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`  ⊘ ${file} already applied, skipping`);
      } else {
        console.error(`  ✗ ${file} failed:`, error.message);
        process.exit(1);
      }
    }
  }

  console.log('\nAll migrations complete.');
  process.exit(0);
}

runMigrations();
