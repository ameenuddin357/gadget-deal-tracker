import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface ResetRecord {
  resetId: string;
  userId: number;
  email: string;
  tokenHash: string;
  expiresAt: number; // Unix timestamp ms
  used: boolean;
  createdAt: number;
}

const STORAGE_FILE = path.join(process.cwd(), 'backend', 'data', 'password_resets.json');

class PasswordResetStore {
  private records: Map<string, ResetRecord> = new Map();

  constructor() {
    this.loadFromDisk();
    // Prune expired records every 10 minutes
    setInterval(() => this.pruneExpired(), 10 * 60 * 1000).unref();
  }

  private loadFromDisk() {
    try {
      const dir = path.dirname(STORAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        const data: ResetRecord[] = JSON.parse(raw);
        for (const item of data) {
          this.records.set(item.tokenHash, item);
        }
      }
    } catch (e) {
      console.warn('[PasswordResetStore] Failed to load stored tokens from disk:', e);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.records.values());
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[PasswordResetStore] Failed to persist tokens to disk:', e);
    }
  }

  private pruneExpired() {
    const now = Date.now();
    let changed = false;
    for (const [hash, record] of this.records.entries()) {
      if (now > record.expiresAt || (record.used && now - record.createdAt > 24 * 60 * 60 * 1000)) {
        this.records.delete(hash);
        changed = true;
      }
    }
    if (changed) {
      this.saveToDisk();
    }
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Create a single-use cryptographically secure reset token (valid for 1 hour).
   * Automatically invalidates previous active tokens for this user.
   */
  async createResetToken(userId: number, email: string): Promise<string> {
    const normalizedEmail = email.toLowerCase().trim();

    // Invalidate existing tokens for this user
    for (const record of this.records.values()) {
      if (record.userId === userId && !record.used) {
        record.used = true;
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour validity

    const newRecord: ResetRecord = {
      resetId: crypto.randomUUID(),
      userId,
      email: normalizedEmail,
      tokenHash,
      expiresAt,
      used: false,
      createdAt: Date.now()
    };

    this.records.set(tokenHash, newRecord);
    this.saveToDisk();

    return rawToken;
  }

  /**
   * Verify token validity without consuming it (for pre-flight validation)
   */
  validateToken(rawToken: string, email?: string): { valid: boolean; userId?: number; email?: string; message?: string } {
    if (!rawToken) {
      return { valid: false, message: 'Reset token is required.' };
    }

    const tokenHash = this.hashToken(rawToken);
    let record = this.records.get(tokenHash);

    // If not in in-memory map, try loading latest from disk storage
    if (!record) {
      this.loadFromDisk();
      record = this.records.get(tokenHash);
    }

    if (!record) {
      return { valid: false, message: 'Password reset link is invalid or has expired.' };
    }

    if (record.used) {
      return { valid: false, message: 'This password reset link has already been used.' };
    }

    if (Date.now() > record.expiresAt) {
      return { valid: false, message: 'This password reset link has expired. Please request a new one.' };
    }

    if (email && record.email.toLowerCase() !== email.toLowerCase().trim()) {
      return { valid: false, message: 'Password reset link does not match the specified email.' };
    }

    return { valid: true, userId: record.userId, email: record.email };
  }

  /**
   * Verify and consume token (atomically marks as used)
   */
  async consumeToken(rawToken: string, email: string): Promise<{ userId: number; email: string } | null> {
    const validation = this.validateToken(rawToken, email);
    if (!validation.valid || !validation.userId) {
      return null;
    }

    const tokenHash = this.hashToken(rawToken);
    let record = this.records.get(tokenHash);
    if (!record) {
      this.loadFromDisk();
      record = this.records.get(tokenHash);
    }

    if (record) {
      record.used = true;
      // Invalidate all tokens for this user
      for (const rec of this.records.values()) {
        if (rec.userId === record.userId) {
          rec.used = true;
        }
      }
      this.saveToDisk();
      return { userId: record.userId, email: record.email };
    }

    return null;
  }
}

export const passwordResetStore = new PasswordResetStore();
