/**
 * Notification Service
 * Orchestrates sending alerts via multiple channels (Email, In-app, etc.)
 */

export interface Recipient {
    email: string;
    id?: string;
}

class NotificationService {
    /**
     * Sends a simulated email.
     * In a production environment, this would integrate with SendGrid, Resend, or Nodemailer.
     */
    async sendEmail(recipient: string, subject: string, body: string): Promise<void> {
        console.log(`\n\uD83D\uDCE7 [EMAIL SERVICE] TO: ${recipient}`);
        console.log(`   SUBJECT: ${subject}`);
        console.log(`   BODY: ${body}`);
        console.log(`--------------------------------------------------\n`);
    }

    /**
     * Sends a simulated WhatsApp message.
     */
    async sendWhatsApp(phone: string, message: string): Promise<void> {
        console.log(`\n\uD83D\uDCAC [WHATSAPP SERVICE] TO: ${phone}`);
        console.log(`   MESSAGE: ${message}`);
        console.log(`--------------------------------------------------\n`);
    }


    /**
     * Broadcasts a notification to a list of users.
     */
    async broadcast(recipients: Recipient[], subject: string, message: string): Promise<void> {
        const emailPromises = recipients.map(r => this.sendEmail(r.email, subject, message));
        await Promise.all(emailPromises);
    }
}

export const notificationService = new NotificationService();

// Keep legacy export for backward compatibility if needed by existing code
export const notifyUsers = (users: { email: string }[], subject: string, message: string) => {
    notificationService.broadcast(users, subject, message);
};
