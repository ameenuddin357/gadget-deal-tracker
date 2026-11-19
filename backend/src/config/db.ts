import pg from 'pg';

const { Pool } = pg;

// Connection pool size: configurable via DB_POOL_MAX, safe default 10, clamped 1–20
const rawPoolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);
const poolMax = !isNaN(rawPoolMax) && rawPoolMax >= 1 && rawPoolMax <= 20 ? rawPoolMax : 10;

// SSL configuration: explicit opt-in via DB_SSL=true
// Defaults to rejecting unauthorized certificates unless DB_SSL_REJECT_UNAUTHORIZED === 'false'
const dbSsl = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
  : false;

// Connection target:
// In production managed environments (e.g. Render), DATABASE_URL is used as connectionString.
// In the current AI Studio runtime, SQL_HOST points to the active Cloud SQL socket (/app/cloudsql/...)
// which is preserved so AI Studio's database configuration and catalogue remain intact.
const isAiStudioCloudSql = Boolean(
  process.env.SQL_HOST && process.env.SQL_HOST.startsWith('/app/cloudsql') && process.env.USE_DATABASE_URL !== 'true'
);
const hasDatabaseUrl = Boolean(
  process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '' && !isAiStudioCloudSql
);

const poolConfig = {
  ...(hasDatabaseUrl
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        port: parseInt(process.env.DB_PORT || '5432', 10),
      }),
  max: poolMax,                  // Maximum number of clients in the pool
  idleTimeoutMillis: 60000,      // Keep idle clients alive for 60 seconds
  connectionTimeoutMillis: 15000,// Allow up to 15 seconds to establish connection during latency spikes
  keepAlive: true,               // Keep TCP connection alive to prevent unexpected drops
  keepAliveInitialDelayMillis: 10000,
  ssl: dbSsl,
};

// Initialize the pg Pool instance
// A single pool instance should be shared across the entire application lifetime
const pool = new Pool(poolConfig);

// Event listener to monitor the pool for unexpected idle client losses
// If a backend connection drops silently while in the pool, this logs it so the pool can recover
pool.on('error', (err) => {
  console.error('Unexpected database client error in connection pool:', err.message || err);
});

/**
 * Safely determines if a query is strictly read-only and idempotent.
 * Only strictly read-only queries (SELECT, EXPLAIN, SHOW) with NO mutating statements or clauses
 * are eligible for automatic transient retry.
 */
export const isSafeReadOnlyQuery = (sql: string): boolean => {
  if (!sql || typeof sql !== 'string') return false;
  const trimmed = sql.trim();
  // Must start with SELECT, EXPLAIN, or SHOW
  if (!/^(SELECT|EXPLAIN|SHOW)\b/i.test(trimmed)) {
    return false;
  }
  // Must NOT contain any data-modifying / DDL / lock keywords
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|MERGE|GRANT|REVOKE|LOCK|INTO)\b/i.test(trimmed)) {
    return false;
  }
  return true;
};

/**
 * Thread-Safe SQL Query Helper
 * Eliminates the risk of leaking active clients. It automatically obtains a client, 
 * executes the SQL query, and releases the client back to the pool instantly.
 * 
 * WRITE SAFETY POLICY:
 * - Read-only queries (SELECT) safely retry up to 2 times on transient network/pool connection hiccups.
 * - Mutation queries (INSERT, UPDATE, DELETE, etc.) are NEVER automatically replayed to prevent duplicate side effects (0 retries).
 * 
 * @param text - SQL Statement (supports parameterized queries to prevent SQL injections)
 * @param params - Array of variables replacing placeholder parameters ($1, $2, etc.)
 */
export const query = async (text: string, params?: any[]) => {
  const isReadOnly = isSafeReadOnlyQuery(text);
  const maxRetries = isReadOnly ? 2 : 0;

  let attempt = 0;
  while (true) {
    attempt++;
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
      const isConnectionError = 
        err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'EPIPE' ||
        err.code === '57P01' ||
        err.code === '57P02' ||
        err.code === '57P03' ||
        err.code === '08006' ||
        err.code === '08001' ||
        err.code === '08004' ||
        err.message?.includes('Connection terminated') ||
        err.message?.includes('connection timeout') ||
        err.message?.includes('timeout') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('EPIPE') ||
        err.message?.includes('write EPIPE') ||
        err.message?.includes('socket hang up') ||
        err.message?.includes('closed unexpectedly') ||
        err.message?.includes('terminating connection');

      if (isConnectionError && attempt <= maxRetries) {
        console.warn(`[SQL Read Retry] Connection hiccup on read query attempt ${attempt}/${maxRetries} (${err.message}). Retrying in ${300 * attempt}ms...`);
        await new Promise(res => setTimeout(res, 300 * attempt));
        continue;
      }

      if (isConnectionError) {
        const dbErr = new Error('Database service is temporarily experiencing latency or reconnecting. Please try again shortly.') as any;
        dbErr.statusCode = 503;
        dbErr.isOperational = true;
        throw dbErr;
      }
      throw err;
    }
  }
};

/**
 * Transaction Helper
 * Provides a dedicated client session for ACID-compliant multi-query transactions.
 * Must manually run COMMIT or ROLLBACK.
 */
export const getClient = async (maxRetries = 2) => {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const client = await pool.connect();
      return client;
    } catch (err: any) {
      const isConnectionError = 
        err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'EPIPE' ||
        err.code === '57P01' ||
        err.code === '57P02' ||
        err.code === '57P03' ||
        err.code === '08006' ||
        err.code === '08001' ||
        err.code === '08004' ||
        err.message?.includes('Connection terminated') ||
        err.message?.includes('connection timeout') ||
        err.message?.includes('timeout') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('EPIPE') ||
        err.message?.includes('write EPIPE') ||
        err.message?.includes('socket hang up') ||
        err.message?.includes('closed unexpectedly') ||
        err.message?.includes('terminating connection');

      if (isConnectionError && attempt <= maxRetries) {
        console.warn(`[DB getClient Retry] Pool connect hiccup on attempt ${attempt}/${maxRetries} (${err.message}). Retrying in ${300 * attempt}ms...`);
        await new Promise(res => setTimeout(res, 300 * attempt));
        continue;
      }

      if (isConnectionError) {
        const dbErr = new Error('Database service is temporarily experiencing latency or reconnecting. Please try again shortly.') as any;
        dbErr.statusCode = 503;
        dbErr.isOperational = true;
        throw dbErr;
      }
      throw err;
    }
  }
};

export default {
  query,
  getClient,
  pool
};
