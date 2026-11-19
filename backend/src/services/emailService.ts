import nodemailer from 'nodemailer';

/**
 * Checks if an SMTP error is due to sandbox / testing restrictions
 * (e.g. Resend free tier with onboarding@resend.dev rejecting non-owner recipients).
 */
function isSandboxRestriction(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  const code = err?.responseCode || 0;
  return (
    code === 550 ||
    msg.includes('550') ||
    msg.includes('only send testing emails') ||
    msg.includes('resend.com/domains') ||
    msg.includes('sandbox')
  );
}

export class EmailService {
  /**
   * Price Alert Email
   */
  static async sendPriceAlertEmail(
    userEmail: string, 
    productName: string, 
    productImage: string, 
    currentPrice: number, 
    targetPrice: number, 
    storeName: string, 
    productUrl: string
  ): Promise<void> {
    const isProduction = process.env.NODE_ENV === 'production';
    const hasSmtp = Boolean(
      process.env.SMTP_HOST && 
      process.env.SMTP_USER && 
      process.env.SMTP_PASSWORD
    );

    if (hasSmtp) {
      try {
        console.log('[EmailService] Dispatching price alert email via SMTP...');
        
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });

        const mailOptions = {
          from: process.env.EMAIL_FROM || '"Gadget Tracker" <alerts@gadgettracker.com>',
          to: userEmail,
          subject: `Price Drop Alert: ${productName} is now ₹${currentPrice}!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
              <h2 style="color: #4F46E5; margin-bottom: 16px;">Your Price Target Reached! 🎉</h2>
              <p style="font-size: 16px; margin-bottom: 24px;">Great news! The product you are tracking has dropped to or below your target price.</p>
              
              <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
                ${productImage ? `<img src="${productImage}" alt="${productName}" style="max-width: 150px; height: auto; margin-bottom: 16px;" />` : ''}
                <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px;">${productName}</h3>
                
                <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 20px;">
                  <div style="text-align: left;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Current Price</p>
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #10b981;">₹${currentPrice}</p>
                  </div>
                  <div style="text-align: left;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Your Target</p>
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #334155;">₹${targetPrice}</p>
                  </div>
                </div>
                
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;">Available at: <strong>${storeName}</strong></p>
                
                <a href="${productUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">Buy Now</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 12px; text-align: center;">You are receiving this email because you set a price alert on Gadget Tracker Pro.</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Price alert email sent for product: ${productName}`);
        return;
      } catch (smtpErr: any) {
        if (isProduction) {
          console.error('[EmailService] SMTP price alert delivery failed:', smtpErr.message);
          // In production, throw error so alertChecker safely keeps alert active for retry
          throw new Error(`Price alert email delivery failed: ${smtpErr.message}`);
        }

        // Development fallback only
        if (isSandboxRestriction(smtpErr)) {
          console.log(`[EmailService - DEV] Resend sandbox restriction for ${userEmail}. Simulated notification logged below.`);
        } else {
          console.log(`[EmailService - DEV] SMTP delivery failed for ${userEmail}. Simulated notification logged below.`);
        }
        console.log(`
      ======================================================
      📩 EMAIL DISPATCH (DEV SIMULATION ONLY)
      To: ${userEmail}
      Subject: Price Drop Alert: ${productName} is now ₹${currentPrice}!
      
      🎉 Your price target has been reached!
      Product: ${productName}
      Current price: ₹${currentPrice}
      Your target: ₹${targetPrice}
      Available at: ${storeName}
      [ BUY NOW ] -> ${productUrl}
      ======================================================
        `);
        return;
      }
    }

    // When no SMTP configured
    if (isProduction) {
      console.error('[EmailService] SMTP credentials missing in production. Price alert email could not be delivered.');
      throw new Error('SMTP credentials not configured in production.');
    }

    console.log(`[EmailService - DEV MODE] Email credentials missing. Logging simulated output.`);
    console.log(`
      ======================================================
      📩 EMAIL DISPATCH (DEV SIMULATION ONLY)
      To: ${userEmail}
      Subject: Price Drop Alert: ${productName} is now ₹${currentPrice}!
      
      🎉 Your price target has been reached!
      Product: ${productName}
      Current price: ₹${currentPrice}
      Your target: ₹${targetPrice}
      Available at: ${storeName}
      [ BUY NOW ] -> ${productUrl}
      ======================================================
    `);
  }

  /**
   * Password Reset Email
   */
  static async sendPasswordResetEmail(
    userEmail: string,
    resetLink: string,
    username?: string
  ): Promise<boolean> {
    const recipientName = username || 'Gadget Enthusiast';
    const isProduction = process.env.NODE_ENV === 'production';
    const hasSmtp = Boolean(
      process.env.SMTP_HOST && 
      process.env.SMTP_USER && 
      process.env.SMTP_PASSWORD && 
      process.env.SMTP_HOST !== 'smtp.example.com'
    );

    if (hasSmtp) {
      try {
        console.log('[EmailService] Sending password reset email via SMTP...');

        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });

        const mailOptions = {
          from: process.env.EMAIL_FROM || '"Gadget Tracker Pro" <auth@gadgettracker.com>',
          to: userEmail,
          subject: 'Reset Your Gadget Tracker Pro Password',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #4f46e5; margin: 0 0 8px 0; font-size: 24px;">Gadget Tracker Pro</h2>
                <p style="color: #64748b; font-size: 14px; margin: 0;">Password Reset Request</p>
              </div>
              
              <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <p style="font-size: 15px; margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>
                <p style="font-size: 14px; color: #475569; line-height: 1.6;">We received a request to reset the password for your Gadget Tracker Pro account. Click the button below to choose a new secure password:</p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${resetLink}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 15px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);">Reset My Password</a>
                </div>
                
                <p style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Or copy and paste this URL into your browser:</p>
                <p style="font-size: 11px; color: #4f46e5; word-break: break-all; background: #f1f5f9; padding: 8px; border-radius: 4px; margin: 0;">${resetLink}</p>
                
                <div style="border-top: 1px solid #f1f5f9; margin-top: 24px; padding-top: 16px;">
                  <p style="font-size: 12px; color: #94a3b8; margin: 0;">⏳ This password reset link is valid for <strong>1 hour</strong> and can only be used once.</p>
                  <p style="font-size: 12px; color: #94a3b8; margin: 6px 0 0 0;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                </div>
              </div>
              
              <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Gadget Tracker Pro. All rights reserved.</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log('[EmailService] Password reset email successfully dispatched.');
        return true;
      } catch (smtpErr: any) {
        if (isProduction) {
          // In production: NEVER log reset URLs, tokens, or recipient emails, report failure cleanly
          console.error('[EmailService] Password reset SMTP delivery failed:', smtpErr.message);
          return false;
        }

        // Development simulation only
        if (isSandboxRestriction(smtpErr)) {
          console.log(`[EmailService - DEV] Resend sandbox restriction for ${userEmail}. Simulated link logged below.`);
        } else {
          console.log(`[EmailService - DEV] SMTP delivery failed for ${userEmail}. Simulated link logged below.`);
        }
        console.log(`
      ======================================================
      📩 PASSWORD RESET EMAIL DISPATCH (DEV ONLY)
      To: ${userEmail}
      Subject: Reset Your Gadget Tracker Pro Password
      
      Hello ${recipientName},
      
      Reset Link: ${resetLink}
      ======================================================
        `);
        return true;
      }
    }

    // No SMTP credentials
    if (isProduction) {
      console.error('[EmailService] SMTP credentials not configured in production. Password reset email could not be delivered.');
      return false;
    }

    console.log(`[EmailService - DEV MODE] Email credentials missing. Logging output for development testing.`);
    console.log(`
      ======================================================
      📩 PASSWORD RESET EMAIL DISPATCH (DEV ONLY)
      To: ${userEmail}
      Subject: Reset Your Gadget Tracker Pro Password
      
      Hello ${recipientName},
      
      Reset Link: ${resetLink}
      ======================================================
    `);
    return true;
  }

  /**
   * Email Verification
   */
  static async sendVerificationEmail(
    userEmail: string,
    verificationLink: string,
    username?: string
  ): Promise<boolean> {
    const recipientName = username || 'Gadget Enthusiast';
    const isProduction = process.env.NODE_ENV === 'production';
    const hasSmtp = Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.SMTP_HOST !== 'smtp.example.com' &&
      process.env.SMTP_USER !== 'your_smtp_username'
    );

    if (isProduction && !hasSmtp) {
      console.error('[EmailService] In production, valid SMTP configuration is required for email verification.');
      return false;
    }

    if (hasSmtp) {
      try {
        console.log('[EmailService] Sending email verification via SMTP...');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });

        const mailOptions = {
          from: process.env.EMAIL_FROM || '"Gadget Tracker Pro" <auth@gadgettracker.com>',
          to: userEmail,
          subject: 'Verify Your Email — Gadget Tracker Pro',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #4f46e5; margin: 0 0 8px 0; font-size: 24px;">Gadget Tracker Pro</h2>
                <p style="color: #64748b; font-size: 14px; margin: 0;">Account Email Verification</p>
              </div>
              
              <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <p style="font-size: 15px; margin-top: 0;">Welcome, <strong>${recipientName}</strong>!</p>
                <p style="font-size: 14px; color: #475569; line-height: 1.6;">Thank you for creating an account on Gadget Tracker Pro. To activate your account and start tracking the best prices across major stores, please verify your email address by clicking the button below:</p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${verificationLink}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 15px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);">Verify Email Address</a>
                </div>
                
                <p style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Or copy and paste this verification link into your browser:</p>
                <p style="font-size: 11px; color: #4f46e5; word-break: break-all; background: #f1f5f9; padding: 8px; border-radius: 4px; margin: 0;">${verificationLink}</p>
                
                <div style="border-top: 1px solid #f1f5f9; margin-top: 24px; padding-top: 16px;">
                  <p style="font-size: 12px; color: #94a3b8; margin: 0;">⏳ This verification link is valid for <strong>60 minutes</strong>.</p>
                  <p style="font-size: 12px; color: #94a3b8; margin: 6px 0 0 0;">If you did not register for a Gadget Tracker Pro account, you can safely ignore this email. No account will be activated without verification.</p>
                </div>
              </div>
              
              <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Gadget Tracker Pro. All rights reserved.</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log('[EmailService] Email verification message successfully dispatched.');
        return true;
      } catch (smtpErr: any) {
        if (isProduction) {
          // In production: NEVER simulate delivery, NEVER log tokens, URLs, or recipient emails
          console.error('[EmailService] SMTP verification delivery failed:', smtpErr.message);
          return false;
        }

        // Development fallback only
        if (isSandboxRestriction(smtpErr)) {
          console.log(`[EmailService - DEV] Resend sandbox restriction for ${userEmail}. Simulated link logged below.`);
        } else {
          console.log(`[EmailService - DEV] SMTP delivery failed for ${userEmail}. Simulated link logged below.`);
        }
      }
    }

    // In production, failure to send via SMTP means delivery failed
    if (isProduction) {
      return false;
    }

    // Development / Sandbox simulation fallback ONLY when NODE_ENV !== "production"
    console.log(`
      ======================================================
      📩 EMAIL VERIFICATION DISPATCH (DEV SIMULATION ONLY)
      To: ${userEmail}
      Subject: Verify Your Email — Gadget Tracker Pro
      
      Hello ${recipientName},
      
      Verification Link: ${verificationLink}
      Link Expires: 60 minutes
      ======================================================
    `);
    return true;
  }
}

