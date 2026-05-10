import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres_password',
  database: process.env.DB_NAME || 'auth_db',
  max: 20, // max number of connection can be open to database
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};

export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;

  // monkey patch the query method to keep track of the last query executed
  const monkeyPatch = (text: string, params?: any[]) => {
    // @ts-ignore
    client.lastQuery = params;
    // @ts-ignore
    return query.apply(client, [text, params]);
  };
  // @ts-ignore
  client.query = monkeyPatch;

  return {
    client,
    release: () => {
      // @ts-ignore
      client.query = query;
      release.apply(client);
    },
  };
};

export default {
  query,
  getClient,
  pool,
};
