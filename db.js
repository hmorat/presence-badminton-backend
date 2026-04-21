import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.SUPABASE_CONN,
  ssl: {
    rejectUnauthorized: false,
  },
});