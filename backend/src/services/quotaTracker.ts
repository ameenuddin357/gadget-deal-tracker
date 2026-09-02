import dotenv from 'dotenv';
import db from '../config/db.ts';

dotenv.config();

interface CallLog {
  timestamp: number;
}

export class QuotaTracker {
  // In-memory counters for the current run (since server start) as fallback
  private static runCounts = {
    amazon: 0,
    google: 0,
    flipkart: 0
  };

  // Timestamp logs to enforce rolling window / monthly caps in-memory fallback
  private static callLogs: { [source: string]: CallLog[] } = {
    amazon: [],
    google: [],
    flipkart: []
  };

  /**
   * Get billing cycle start day from environment variable
   */
  public static getBillingCycleStartDay(): number {
    return parseInt(process.env.BILLING_CYCLE_START_DAY || '1', 10);
  }

  /**
   * Calculate the start Date of the current billing period
   */
  public static getBillingCycleStartDate(): Date {
    const startDay = this.getBillingCycleStartDay();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    let billingStartDate = new Date(currentYear, currentMonth, startDay, 0, 0, 0, 0);
    if (now < billingStartDate) {
      billingStartDate = new Date(currentYear, currentMonth - 1, startDay, 0, 0, 0, 0);
    }
    return billingStartDate;
  }

  /**
   * Calculate the end Date of the current billing period
   */
  public static getBillingCycleEndDate(): Date {
    const startDate = this.getBillingCycleStartDate();
    const nextDate = new Date(startDate);
    nextDate.setMonth(startDate.getMonth() + 1);
    return nextDate;
  }

  /**
   * Get days until the billing cycle resets
   */
  public static getDaysUntilReset(): number {
    const endDate = this.getBillingCycleEndDate();
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  /**
   * Get the monthly cap for each source
   */
  public static getCap(source: 'amazon' | 'google' | 'flipkart'): number {
    if (source === 'amazon') {
      return parseInt(process.env.AMAZON_MONTHLY_CAP || '85', 10);
    }
    if (source === 'google') {
      return parseInt(process.env.GOOGLE_SHOPPING_MONTHLY_CAP || '85', 10);
    }
    if (source === 'flipkart') {
      return parseInt(process.env.FLIPKART_MONTHLY_CAP || '5', 10);
    }
    return 85;
  }

  /**
   * Records a successful or attempted external API request.
   */
  public static async recordCall(source: 'amazon' | 'google' | 'flipkart'): Promise<void> {
    const timestamp = Date.now();
    this.runCounts[source]++;
    this.callLogs[source].push({ timestamp });

    try {
      await db.query(
        'INSERT INTO api_call_logs (source, timestamp) VALUES ($1, $2)',
        [source, timestamp]
      );
    } catch (err: any) {
      console.warn(`[QuotaTracker DB Write Error] Using memory fallback: ${err.message}`);
    }

    const cycleCount = await this.getCallsInCurrentBillingCycle(source);
    const cap = this.getCap(source);

    console.log(`\n================== [CREDIT MONITOR] ==================`);
    console.log(`Source: ${source.toUpperCase()}`);
    console.log(`- Request Count This Run: ${this.runCounts[source]}`);
    console.log(`- Requests in Current Monthly Billing Cycle: ${cycleCount} / ${cap}`);
    console.log(`- Days Until Reset: ${this.getDaysUntilReset()}`);
    console.log(`======================================================\n`);
  }

  /**
   * Checks if the monthly billing cycle cap has been hit for a given source.
   */
  public static async isCapExceeded(source: 'amazon' | 'google' | 'flipkart'): Promise<boolean> {
    const cycleCount = await this.getCallsInCurrentBillingCycle(source);
    const cap = this.getCap(source);

    if (cycleCount >= cap) {
      console.warn(`[Quota Safety Triggered] ${source.toUpperCase()} has exceeded its monthly cap of ${cap} requests (used: ${cycleCount}). Falling back to cached results or skip.`);
      return true;
    }
    return false;
  }

  /**
   * Get total calls made to all sources combined or individual for debugging
   */
  public static async getStats() {
    const offsets: Record<string, number> = { amazon: 0, google: 0, flipkart: 0 };
    try {
      const res = await db.query('SELECT source, offset_value FROM api_quota_calibration');
      for (const row of res.rows) {
        offsets[row.source] = row.offset_value;
      }
    } catch (err: any) {
      console.warn('[QuotaTracker] Failed to fetch calibration offsets:', err.message);
    }

    return {
      runCounts: { ...this.runCounts },
      billingCycleCounts: {
        amazon: await this.getCallsInCurrentBillingCycle('amazon'),
        google: await this.getCallsInCurrentBillingCycle('google'),
        flipkart: await this.getCallsInCurrentBillingCycle('flipkart')
      },
      offsets,
      caps: {
        amazon: this.getCap('amazon'),
        google: this.getCap('google'),
        flipkart: this.getCap('flipkart')
      },
      daysUntilReset: this.getDaysUntilReset(),
      billingCycleStart: this.getBillingCycleStartDate().toISOString(),
      billingCycleEnd: this.getBillingCycleEndDate().toISOString()
    };
  }

  /**
   * Helper to clean up old logs and count remaining within the current billing cycle.
   */
  public static async getCallsInCurrentBillingCycle(source: 'amazon' | 'google' | 'flipkart', excludeOffset: boolean = false): Promise<number> {
    const startDate = this.getBillingCycleStartDate();
    const startMs = startDate.getTime();
    let dbCount = 0;
    try {
      const res = await db.query(
        'SELECT COUNT(*)::int as count FROM api_call_logs WHERE source = $1 AND timestamp >= $2',
        [source, startMs]
      );
      // Asynchronously prune older entries (older than 90 days) to keep DB size managed
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      db.query('DELETE FROM api_call_logs WHERE timestamp < $1', [ninetyDaysAgo]).catch(err => {
        console.warn('[QuotaTracker DB Prune Error] Ignored:', err.message);
      });
      dbCount = res.rows[0]?.count || 0;
    } catch (err: any) {
      console.warn(`[QuotaTracker DB Read Error] Falling back to memory structure: ${err.message}`);
      this.callLogs[source] = this.callLogs[source].filter(log => log.timestamp >= startMs);
      dbCount = this.callLogs[source].length;
    }

    if (excludeOffset) {
      return dbCount;
    }

    // Add calibration offset if present
    let offset = 0;
    try {
      const calibrationRes = await db.query(
        'SELECT offset_value FROM api_quota_calibration WHERE source = $1',
        [source]
      );
      offset = calibrationRes.rows[0]?.offset_value || 0;
    } catch (err: any) {
      console.warn(`[QuotaTracker Calibration Read Error] Bypassing offset: ${err.message}`);
    }

    return dbCount + offset;
  }

  /**
   * Set calibration offset for a given source
   */
  public static async setCalibrationOffset(source: 'amazon' | 'google' | 'flipkart', offset: number): Promise<void> {
    try {
      await db.query(
        'INSERT INTO api_quota_calibration (source, offset_value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (source) DO UPDATE SET offset_value = EXCLUDED.offset_value, updated_at = CURRENT_TIMESTAMP',
        [source, offset]
      );
    } catch (err: any) {
      console.error(`[QuotaTracker Set Calibration Error]: ${err.message}`);
      throw err;
    }
  }
}
