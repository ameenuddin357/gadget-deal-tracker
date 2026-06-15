import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const { Pool } = pg;

// Connection Pool Configuration settings
// Using individual parameters or standard DATABASE_URL fallback as per industry best practices
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_secure_password',
  database: process.env.DB_DATABASE || 'deal_tracker',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  // Connection Pool Tuning Parameters - critical for placements!
  max: 20,                       // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,      // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Error out if connection takes longer than 2 seconds
};

// Initialize the pg Pool instance
// A single pool instance should be shared across the entire application lifetime
const pool = new Pool(
  process.env.DATABASE_URL 
    ? { 
        connectionString: process.env.DATABASE_URL, 
        max: 20,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      } 
    : poolConfig
);

// Event listener to monitor the pool for unexpected idle client losses
// If a backend connection drops silently while in the pool, this logs it so the pool can recover
pool.on('error', (err) => {
  console.error('Unexpected database client error in connection pool:', err);
});

/**
 * Thread-Safe SQL Query Helper
 * Eliminates the risk of leaking active clients. It automatically obtains a client, 
 * executes the SQL query, and releases the client back to the pool instantly.
 * 
 * @param text - SQL Statement (supports parameterized queries to prevent SQL injections)
 * @param params - Array of variables replacing placeholder parameters ($1, $2, etc.)
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log queries in development mode to monitor runtime performance bottlenecks
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SQL EXEC] executed query: ${text.split('\n')[0]}... took ${duration}ms`);
    }
    return res;
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      const dbErr = new Error('Database service is currently offline or connection was refused. Please try again later.') as any;
      dbErr.statusCode = 503;
      dbErr.isOperational = true;
      throw dbErr;
    }
    throw err;
  }
};

/**
 * Transaction Helper
 * Provides a dedicated client session for ACID-compliant multi-query transactions.
 * Must manually run COMMIT or ROLLBACK.
 */
export const getClient = async () => {
  try {
    const client = await pool.connect();
    return client;
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      const dbErr = new Error('Database service is currently offline or connection was refused. Please try again later.') as any;
      dbErr.statusCode = 503;
      dbErr.isOperational = true;
      throw dbErr;
    }
    throw err;
  }
};

export default {
  query,
  getClient,
  pool
};
