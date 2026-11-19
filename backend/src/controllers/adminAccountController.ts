import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

/**
 * ADMIN ACCOUNT CONTROLLER - CHANGE EMAIL
 * PATCH /api/admin/account/email
 * 
 * Required security flow:
 * - Admin enters CURRENT PASSWORD, NEW EMAIL, CONFIRM NEW EMAIL
 * - Backend verifies current password
 * - Backend verifies user is ADMIN in database (never trust role from client)
 * - Ensures new email is not used by another account
 * - Updates admin email in database
 * - Because verification is disabled: do NOT send email, do NOT generate verification token
 * - Does NOT print new email in server logs
 */
export const updateAdminEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newEmail, confirmEmail } = req.body;

    // Validate all fields present
    if (!currentPassword || !newEmail || !confirmEmail) {
      return next(new AppError('Current password, new email, and confirmation email are required.', 400));
    }

    // currentPassword type/length safe
    if (typeof currentPassword !== 'string' || currentPassword.length === 0 || currentPassword.length > 128) {
      return next(new AppError('Current password is invalid.', 400));
    }

    if (typeof newEmail !== 'string' || typeof confirmEmail !== 'string') {
      return next(new AppError('Invalid email format.', 400));
    }

    // Lowercase + trim email
    const normalizedNewEmail = newEmail.toLowerCase().trim();
    const normalizedConfirmEmail = confirmEmail.toLowerCase().trim();

    // newEmail valid format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedNewEmail)) {
      return next(new AppError('Please provide a valid email address.', 400));
    }

    // confirmEmail matches normalized newEmail
    if (normalizedNewEmail !== normalizedConfirmEmail) {
      return next(new AppError('New email and confirmation email do not match.', 400));
    }

    // Identify admin using authenticated req.user.userId
    const userId = (req as any).user?.userId;
    if (!userId) {
      return next(new AppError('Authentication required.', 401));
    }

    // Load password_hash, role, email for authenticated user_id from DB
    const userRes = await db.query(
      'SELECT user_id, username, email, password_hash, role FROM users WHERE user_id = $1;',
      [userId]
    );

    if (userRes.rows.length === 0) {
      return next(new AppError('User account not found.', 404));
    }

    const adminUser = userRes.rows[0];

    // Verify user is ADMIN in database
    if (adminUser.role !== 'admin') {
      return next(new AppError('Access forbidden. Administrator privileges required.', 403));
    }

    // Check new email differs from current email
    if (normalizedNewEmail === adminUser.email.toLowerCase().trim()) {
      return next(new AppError('New email must be different from your current email.', 400));
    }

    if (!adminUser.password_hash) {
      return next(new AppError('Account password has not been set.', 400));
    }

    // Verify current password with bcrypt
    const isPasswordValid = await bcrypt.compare(currentPassword, adminUser.password_hash);
    if (!isPasswordValid) {
      // Sanitized message, do not reveal password/hash
      return next(new AppError('Current password is incorrect.', 401));
    }

    // Email uniqueness check:
    // SELECT user_id FROM users WHERE email = $1 AND user_id <> $2
    const checkSql = 'SELECT user_id FROM users WHERE email = $1 AND user_id <> $2;';
    const checkRes = await db.query(checkSql, [normalizedNewEmail, adminUser.user_id]);
    if (checkRes.rows.length > 0) {
      return next(new AppError('An account with this email already exists.', 409));
    }

    // Update admin email:
    // Only after ALL validations pass:
    // UPDATE users SET email = $1 WHERE user_id = $2 RETURNING user_id, username, email, role;
    // Do NOT modify: password_hash, username, role, is_verified, created_at
    // Do NOT print the new email in server logs
    const updateSql = `
      UPDATE users
      SET email = $1
      WHERE user_id = $2
      RETURNING user_id, username, email, role;
    `;
    const updateRes = await db.query(updateSql, [normalizedNewEmail, adminUser.user_id]);
    const updatedUser = updateRes.rows[0];

    console.log(`[Admin Account] Email updated successfully for admin user ID ${updatedUser.user_id}.`);

    res.status(200).json({
      status: 'success',
      message: 'Admin email updated successfully. Please sign in again with your new email.',
      data: {
        user: {
          userId: updatedUser.user_id,
          username: updatedUser.username,
          role: updatedUser.role
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
