/** Colors and typography adapted from brume_front/src/styles/_tokens.scss. */
export interface GenericEmailContent {
  subject: string;
  content: string;
  title?: string;
  preheader?: string;
  action?: { label: string; url: string };
}
export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const theme = {
  ink: '#151515',
  background: '#f4f1eb',
  paper: '#faf8f4',
  line: '#e0dbd2',
  muted: '#77716a',
  olive: '#6e7a55',
  heading: "'Bricolage Grotesque','Geist',Arial,Helvetica,sans-serif",
  body: "'Geist',Arial,Helvetica,sans-serif",
};
export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
function checkText(
  value: unknown,
  name: string,
  max: number,
): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${name} invalide.`);
}
export function validateEmailContent(email: GenericEmailContent): void {
  checkText(email.subject, 'Objet email', 200);
  if (/[\r\n]/.test(email.subject)) throw new Error('Objet email invalide.');
  checkText(email.content, 'Contenu email', 20000);
  if (email.title !== undefined) checkText(email.title, 'Titre email', 300);
  if (email.preheader !== undefined)
    checkText(email.preheader, 'Aperçu email', 300);
  if (email.action !== undefined) {
    checkText(email.action.label, 'Libellé du bouton', 100);
    checkText(email.action.url, 'Lien du bouton', 2048);
    let url: URL;
    try {
      url = new URL(email.action.url);
    } catch {
      throw new Error('Lien email invalide.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      Array.from(email.action.url).some(
        (character) =>
          character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
      )
    )
      throw new Error('Lien email invalide.');
  }
}

/** Text content is always escaped. HTML and scripts supplied as content remain literal text. */
export function createBrumeEmail(
  email: GenericEmailContent,
  frontend: string,
): RenderedEmail {
  validateEmailContent(email);
  // Revalidate the public origin even for direct calls to this pure template builder.
  const home = new URL(frontend);
  if (
    !['http:', 'https:'].includes(home.protocol) ||
    home.username ||
    home.password
  )
    throw new Error('Origine Brume invalide.');
  const homeUrl = escapeHtml(home.origin);
  const title = escapeHtml(email.title ?? email.subject).replace(
    /\r?\n/g,
    '<br>',
  );
  const preview = escapeHtml(
    email.preheader ?? email.content.replace(/\s+/g, ' ').slice(0, 180),
  );
  const paragraphs = email.content
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:${theme.ink};">${escapeHtml(paragraph).replace(/\r?\n/g, '<br>')}</p>`,
    )
    .join('');
  const button = email.action
    ? `<tr><td class="email-pad" style="padding:8px 40px 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${theme.ink}" style="border-radius:999px;mso-padding-alt:18px 28px;">
    <a href="${escapeHtml(email.action.url)}" style="display:inline-block;padding:18px 28px;border:1px solid ${theme.ink};border-radius:999px;color:${theme.paper};font-family:${theme.body};font-size:14px;font-weight:500;line-height:18px;text-decoration:none;">${escapeHtml(email.action.label)}&nbsp;&nbsp;→</a>
    </td></tr></table>
  </td></tr>
  <tr><td class="email-pad" style="padding:0 40px 32px;"><p style="margin:0;font-size:12px;line-height:1.65;color:${theme.muted};">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p><a href="${escapeHtml(email.action.url)}" style="font-size:12px;line-height:1.65;color:${theme.olive};text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${escapeHtml(email.action.url)}</a></td></tr>`
    : '';
  return {
    subject: email.subject,
    text: `${email.title ? email.title + '\n\n' : ''}${email.content}${email.action ? '\n\n' + email.action.label + ' : ' + email.action.url : ''}\n\nL’équipe Brume\nInfuser, lentement.\n${home.origin}`,
    html: `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(email.subject)}</title>
<style>@media only screen and (max-width:600px){.email-pad{padding-left:24px!important;padding-right:24px!important}.email-title{font-size:38px!important}.email-wordmark{font-size:72px!important}.email-tagline{font-size:9px!important}}</style></head>
<body style="margin:0;padding:0;width:100%;background-color:${theme.background};color:${theme.ink};font-family:${theme.body};-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${theme.background}"><tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${theme.paper}" style="width:100%;max-width:600px;border:1px solid ${theme.line};">
<tr><td class="email-pad" style="padding:28px 40px;border-bottom:1px solid ${theme.line};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><a href="${homeUrl}" style="font-family:${theme.heading};font-size:26px;font-weight:800;letter-spacing:-1px;color:${theme.ink};text-decoration:none;">BRUME</a></td><td class="email-tagline" align="right" style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${theme.muted};">Infuser, lentement.</td></tr></table>
</td></tr>
<tr><td class="email-pad" style="padding:40px 40px 16px;"><p style="margin:0;font-size:10px;font-weight:500;line-height:1.4;letter-spacing:2.2px;text-transform:uppercase;color:${theme.olive};">Un mot de Brume</p></td></tr>
<tr><td class="email-pad" style="padding:0 40px 28px;"><h1 class="email-title" style="margin:0;font-family:${theme.heading};font-size:48px;font-weight:800;line-height:1.02;letter-spacing:-2px;overflow-wrap:anywhere;">${title}</h1></td></tr>
<tr><td class="email-pad" style="padding:0 40px 12px;">${paragraphs}</td></tr>
${button}
<tr><td class="email-pad" style="padding:4px 40px 36px;"><p style="margin:0;font-size:14px;line-height:1.7;">À très bientôt,<br><strong>L’équipe Brume</strong></p></td></tr>
<tr><td class="email-pad" bgcolor="${theme.olive}" style="padding:16px 40px;"><p style="margin:0;font-size:10px;line-height:1.5;letter-spacing:2px;text-transform:uppercase;color:${theme.paper};">Une tasse, puis une autre.</p></td></tr>
<tr><td class="email-pad" bgcolor="${theme.ink}" style="padding:28px 40px 32px;"><p class="email-wordmark" style="margin:0 0 20px;font-family:${theme.heading};font-size:96px;font-weight:800;line-height:1;letter-spacing:-6px;color:${theme.background};">Brume</p><p style="margin:0;font-size:11px;line-height:1.7;color:#a9a39a;">Thé · Café · CBD<br><a href="${homeUrl}" style="color:${theme.background};text-decoration:underline;">Retrouver Brume</a></p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
  };
}
