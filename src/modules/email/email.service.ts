// Import des fonctionnalités NATIVES de NestJS
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  // ENVOI DU CODE 2FA
  async send2FACode(email: string, code: string): Promise<boolean> {
    console.log(`📧 [EmailService] Envoi code 2FA à: ${email}`);
    
    try {
      const result = await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [email],
        subject: 'Code de vérification 2FA - Lutea',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5530;">🔐 Code de vérification 2FA</h2>
            <p>Bonjour,</p>
            <p>Voici votre code de vérification pour finaliser votre connexion :</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #2c5530; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
            </div>
            <p><strong>Ce code expire dans 10 minutes.</strong></p>
            <p>Si vous n'avez pas demandé ce code, ignorez cet email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Lutea - Retraites bien-être</p>
          </div>
        `
      });

      console.log(`✅ [EmailService] Code 2FA envoyé avec succès à: ${email}`, result.data?.id || 'ID non disponible');
      return true;
    } catch (error) {
      console.log(`❌ [EmailService] Erreur envoi code 2FA à: ${email}`, error.message);
      return false;
    }
  }

  // ENVOI DE L'EMAIL DE VALIDATION D'INSCRIPTION
  async sendRegistrationValidation(email: string, verificationToken: string): Promise<boolean> {
    try {
      const link = `${process.env.FRONTEND_URL}/validate-email?token=${verificationToken}`;
      
      await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Validez votre adresse email - Lutea',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">🎉 Bienvenue sur Lutea !</h2>
            <p>Merci de vous être inscrit sur Lutea.</p>
            <p>Pour finaliser votre inscription, veuillez valider votre adresse email en cliquant sur le bouton ci-dessous :</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">✅ Valider mon email</a>
            </div>
            <p>Ou copiez ce lien dans votre navigateur :</p>
            <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">${link}</p>
            <p style="color: #666; font-size: 14px;">Ce lien expire dans 24 heures.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">Cet email a été envoyé automatiquement par Lutea</p>
          </div>
        `,
      });
      
      this.logger.log(`✅ Email de validation envoyé avec succès à ${email}`);
      return true;
      
    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'envoi de l'email de validation à ${email}:`, error);
      return false;
    }
  }

  // ENVOI DE L'EMAIL DE RÉINITIALISATION DE MOT DE PASSE
  async sendPasswordReset(email: string, resetToken: string): Promise<boolean> {
    try {
      const link = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Réinitialisation de votre mot de passe - Lutea',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">🔑 Réinitialisation de mot de passe</h2>
            <p>Vous avez demandé une réinitialisation de votre mot de passe sur Lutea.</p>
            <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">🔐 Réinitialiser mon mot de passe</a>
            </div>
            <p>Ou copiez ce lien dans votre navigateur :</p>
            <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">${link}</p>
            <p style="color: #666; font-size: 14px;">⚠️ Ce lien expire dans 1 heure.</p>
            <p style="color: #666; font-size: 14px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">Cet email a été envoyé automatiquement par Lutea</p>
          </div>
        `,
      });
      
      this.logger.log(`✅ Email de réinitialisation envoyé avec succès à ${email}`);
      return true;
      
    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'envoi de l'email de réinitialisation à ${email}:`, error);
      return false;
    }
  }

  // ENVOI DE L'EMAIL DE CONTACT (formulaire contact)
  async sendContactEmail(contactData: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    message: string;
  }): Promise<boolean> {
    try {
      await this.resend.emails.send({
        from: 'Lutea <pierreschnell@hotmail.com>',
        to: 'pierreschnell@hotmail.com',
        subject: `Message reçu via le site – ${contactData.nom} ${contactData.prenom}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">📧 Nouveau message de contact</h2>
            <p>Vous avez reçu un nouveau message via le formulaire de contact de Lutea :</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>👤 Nom :</strong> ${contactData.nom}</p>
              <p><strong>👤 Prénom :</strong> ${contactData.prenom}</p>
              <p><strong>📧 Email :</strong> <a href="mailto:${contactData.email}">${contactData.email}</a></p>
              <p><strong>📞 Téléphone :</strong> <a href="tel:${contactData.telephone}">${contactData.telephone}</a></p>
              <p><strong>💬 Message :</strong></p>
              <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #007bff;">
                ${contactData.message.replace(/\n/g, '<br>')}
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="mailto:${contactData.email}" style="background: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block;">📧 Répondre directement</a>
            </div>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">Message reçu via le formulaire de contact de Lutea</p>
          </div>
        `,
      });
      
      this.logger.log(`✅ Email de contact envoyé avec succès depuis ${contactData.email}`);
      return true;
      
    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'envoi de l'email de contact depuis ${contactData.email}:`, error);
      return false;
    }
  }
}
