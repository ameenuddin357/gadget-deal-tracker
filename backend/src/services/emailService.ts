import nodemailer from 'nodemailer';

export class EmailService {
  static async sendPriceAlertEmail(
    userEmail: string, 
    productName: string, 
    productImage: string, 
    currentPrice: number, 
    targetPrice: number, 
    storeName: string, 
    productUrl: string
  ): Promise<void> {
    // If SMTP credentials exist, send a real email using Nodemailer
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      console.log(`[EmailService] Connecting to SMTP provider...`);
      
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
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
      console.log(`[EmailService] Real email sent to ${userEmail} for product: ${productName}`);
    } else {
      console.log(`[EmailService - DEV MODE] Email credentials missing. Logging output instead.`);
      console.log(`
      ======================================================
      📩 EMAIL DISPATCH (SIMULATED)
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
  }

  static async sendPasswordResetEmail(
    userEmail: string,
    resetLink: string,
    username?: string
  ): Promise<void> {
    const recipientName = username || 'Gadget Enthusiast';

    // If SMTP credentials exist, send a real email using Nodemailer
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_HOST !== 'smtp.example.com') {
      try {
        console.log(`[EmailService] Sending password reset email via SMTP to ${userEmail}...`);

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
        console.log(`[EmailService] Password reset email successfully dispatched to ${userEmail}`);
      } catch (smtpErr: any) {
        console.warn(`[EmailService] SMTP delivery failed (${smtpErr.message}). Falling back to safe logging.`);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        console.warn(`[EmailService] SMTP credentials not configured in production environment. Password reset email could not be delivered to ${userEmail}.`);
      } else {
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
      }
    }
  }
}
