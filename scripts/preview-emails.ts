import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createBrumeEmail } from '../src/modules/mail/email-template';
import { renderEmail } from '../src/modules/mail/templates';

// Offline previews only: no .env, no database, no Mailjet call.
const frontend = 'https://brume.example';
const previews = {
  generic: createBrumeEmail(
    {
      subject: 'Un mot de Brume',
      title: 'Les petits\nrituels.',
      content:
        'Bonjour Camille,\n\nUne tasse chaude, quelques minutes pour soi. Il suffit parfois de peu pour faire une place à ce qui compte.\n\nRetrouvez vos thés, cafés et créations dans votre espace Brume.',
      preheader: 'Faire une place aux petits rituels du quotidien.',
      action: { label: 'Retrouver Brume', url: `${frontend}/compte` },
    },
    frontend,
  ),
  confirmation: renderEmail(
    'account.confirm',
    { token: 'exemple-sans-valeur' },
    frontend,
  ),
  reset: renderEmail(
    'account.reset',
    { token: 'exemple-sans-valeur' },
    frontend,
  ),
  order: renderEmail(
    'order.confirmed',
    { orderId: '11111111-1111-4111-8111-111111111111' },
    frontend,
  ),
};
const directory = join(__dirname, '../docs/email-previews');
mkdirSync(directory, { recursive: true });
for (const [name, email] of Object.entries(previews)) {
  writeFileSync(join(directory, `${name}.html`), email.html);
}
console.log(
  '4 aperçus HTML générés dans docs/email-previews (aucun email envoyé).',
);
