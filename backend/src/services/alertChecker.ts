import db from '../config/db.ts';
import { EmailService } from './emailService.ts';

export const checkAllActiveAlerts = async (): Promise<void> => {
  console.log('[AlertChecker] Evaluating active price alerts against current database prices...');
  try {
    const sql = `
      SELECT 
        pa.alert_id,
        pa.target_price,
        u.email,
        p.name as product_name,
        p.image_url,
        curr_p.price as current_price,
        s.name as store_name,
        curr_p.product_url
      FROM price_alerts pa
      JOIN users u ON pa.user_id = u.user_id
      JOIN products p ON pa.product_id = p.product_id
      JOIN (
        SELECT DISTINCT ON (product_id) *
        FROM product_prices
        WHERE is_available = TRUE
        ORDER BY product_id, price ASC
      ) curr_p ON pa.product_id = curr_p.product_id
      JOIN stores s ON curr_p.store_id = s.store_id
      WHERE pa.is_active = TRUE;
    `;
    
    const result = await db.query(sql);
    const alerts = result.rows;
    
    for (const alert of alerts) {
      if (parseFloat(alert.current_price) <= parseFloat(alert.target_price)) {
        console.log(`[AlertChecker] Triggering alert ${alert.alert_id} for ${alert.product_name}`);
        
        try {
          await EmailService.sendPriceAlertEmail(
            alert.email,
            alert.product_name,
            alert.image_url,
            parseFloat(alert.current_price),
            parseFloat(alert.target_price),
            alert.store_name,
            alert.product_url || '#'
          );
          
          // Mark alert as triggered ONLY if email sent successfully
          await db.query(`
            UPDATE price_alerts 
             SET is_active = FALSE, alert_sent = TRUE
            WHERE alert_id = $1
          `, [alert.alert_id]);
          
          console.log(`[AlertChecker] Alert ${alert.alert_id} successfully marked as sent.`);
        } catch (emailErr) {
          console.error(`[AlertChecker] Failed to send email for alert ${alert.alert_id}. Keeping alert active for retry.`, emailErr);
          // Do NOT mark as sent, keep it active for retry on next scheduler run.
        }
      }
    }
  } catch (err) {
    console.error('[AlertChecker] Error checking alerts:', err);
  }
};
