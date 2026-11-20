import { MailKind } from './entities/mail.entity';
import {
  createBrumeEmail,
  GenericEmailContent,
  RenderedEmail,
} from './email-template';
export interface EmailPayload {
  orderId?: string;
  token?: string;
  expiresAt?: string;
  generic?: GenericEmailContent;
}
export function renderEmail(
  kind: MailKind,
  payload: EmailPayload,
  frontend: string,
): RenderedEmail {
  if (kind === 'email.generic' && payload.generic)
    return createBrumeEmail(payload.generic, frontend);
  let email: GenericEmailContent;
  if (kind === 'order.confirmed' && payload.orderId) {
    email = {
      subject: 'Brume — Confirmation de commande',
      title: 'Votre commande,\nbientôt chez vous.',
      content: `Votre commande ${payload.orderId} est confirmée. Retrouvez son détail dans votre compte Brume.`,
      preheader:
        'Votre commande est confirmée. Merci de faire une place à Brume dans vos rituels.',
      action: {
        label: 'Voir ma commande',
        url: `${frontend}/compte/commandes/${encodeURIComponent(payload.orderId)}`,
      },
    };
  } else if (
    (kind === 'account.confirm' || kind === 'account.reset') &&
    payload.token
  ) {
    const confirm = kind === 'account.confirm';
    email = {
      subject: confirm
        ? 'Brume — Confirmez votre adresse email'
        : 'Brume — Réinitialisez votre mot de passe',
      title: confirm ? 'Bienvenue\nchez Brume.' : 'Un nouveau\ndépart.',
      content: confirm
        ? 'Votre compte est presque prêt. Confirmez votre adresse email pour retrouver vos commandes et vos prochains rituels.\n\nCe lien est valable 24 heures. Si vous n’êtes pas à l’origine de cette inscription, ignorez cet email.'
        : 'Vous avez demandé à réinitialiser votre mot de passe. Choisissez-en un nouveau pour retrouver votre compte.\n\nCe lien est valable 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.',
      preheader: confirm
        ? 'Un dernier geste avant de prendre le temps : confirmez votre adresse email.'
        : 'Un lien personnel pour choisir votre nouveau mot de passe.',
      // Fragment avoids sending the bearer token in HTTP requests and referrers to the frontend.
      action: {
        label: confirm ? 'Confirmer mon adresse' : 'Choisir mon mot de passe',
        url: `${frontend}/${confirm ? 'confirm-email' : 'reset-password'}#token=${encodeURIComponent(payload.token)}`,
      },
    };
  } else throw new Error('Modèle email invalide.');
  return createBrumeEmail(email, frontend);
}
