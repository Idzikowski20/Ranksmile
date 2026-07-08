import nodeMailer from 'nodemailer';
import { getAppSettings } from '../pages/api/settings';

export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<{ sent: boolean }> {
   const settings = await getAppSettings();
   const {
      smtp_server = '',
      smtp_port = '',
      smtp_username = '',
      smtp_password = '',
      notification_email_from = '',
      notification_email_from_name = 'SerpBear',
   } = settings;

   if (!smtp_server || !smtp_port || !notification_email_from) {
      console.warn('[sendMail] SMTP not fully configured (host/port/from missing). Skipping send.');
      return { sent: false };
   }

   const mailerSettings: { host: string; port: number; auth?: { user?: string; pass?: string } } = {
      host: smtp_server,
      port: parseInt(smtp_port, 10),
   };
   if (smtp_username || smtp_password) {
      mailerSettings.auth = {};
      if (smtp_username) mailerSettings.auth.user = smtp_username;
      if (smtp_password) mailerSettings.auth.pass = smtp_password;
   }

   const from = `${notification_email_from_name} <${notification_email_from}>`;

   try {
      const transporter = nodeMailer.createTransport(mailerSettings);
      await transporter.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
      return { sent: true };
   } catch (err) {
      console.error('[sendMail] Failed to send email:', err);
      return { sent: false };
   }
}
