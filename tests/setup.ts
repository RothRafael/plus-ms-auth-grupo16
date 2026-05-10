import { beforeAll, afterAll, beforeEach } from 'vitest';
import db from '../src/config/database';

// Global setup before all tests
beforeAll(async () => {
  // Ensure DB connection is established
  try {
    await db.query('SELECT 1');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    process.exit(1);
  }
});

// Teardown after all tests
afterAll(async () => {
  // Close DB pool
  await db.pool.end();
});

// Cleanup database before each test to ensure isolation
beforeEach(async () => {
  // We use TRUNCATE for speed, but CASCADE to handle dependencies
  // Important: Do not truncate role_permissions as they are static seeds
  const tables = ['token_blacklist', 'refresh_tokens', 'users'];
  
  for (const table of tables) {
    await db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
  }
});
