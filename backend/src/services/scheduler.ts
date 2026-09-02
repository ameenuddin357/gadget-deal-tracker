import db from '../config/db.ts';
import { checkAllActiveAlerts } from './alertChecker.ts';

const LOCK_ID = 424242;

export const startScheduler = () => {
  // Check active alerts every 1 hour (3600000 ms) against stored DB prices.
  // This does NOT call external APIs. It only checks PostgreSQL.
  setInterval(async () => {
    let client;
    let released = false;
    try {
      client = await db.getClient();
      // Try to acquire the session-level advisory lock
      const lockRes = await client.query('SELECT pg_try_advisory_lock($1)', [LOCK_ID]);
      const acquired = lockRes.rows[0].pg_try_advisory_lock;

      if (!acquired) {
        console.log('[Scheduler] Another instance is running the alert checks. Skipping this cycle.');
        client.release();
        released = true;
        return;
      }

      console.log('[Scheduler] Lock acquired. Running scheduled alert checks...');
      
      try {
        await checkAllActiveAlerts();
      } finally {
        // Always release the lock when done
        await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
        console.log('[Scheduler] Lock released.');
        client.release();
        released = true;
      }
    } catch (error) {
      console.error('[Scheduler] Error during scheduled alert check:', error);
      if (client && !released) {
        client.release();
      }
    }
  }, 3600000);
};
