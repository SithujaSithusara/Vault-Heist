import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing. Set it in .env.local.');
}

export const db = drizzle(databaseUrl, { schema });