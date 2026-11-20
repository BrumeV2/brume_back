import { createBrumeEmail } from './email-template';
import { renderEmail } from './templates';

describe('Emails génériques et structure Brume', () => {
  const base = {
    subject: 'Votre rendez-vous',
    content: 'Bonjour Camille,\n\nVotre rendez-vous est confirmé.',
  };
  const frontend = 'https://brume.example';
  it('produit un objet, un texte et un HTML avec la palette du front et sans bouton imposé', () => {
    const result = createBrumeEmail(base, frontend);
    expect(result.subject).toBe(base.subject);
    expect(result.text).toContain(base.content);
    expect(result.html).toContain('#f4f1eb');
    expect(result.html).toContain('#6e7a55');
    expect(result.html).toContain('role="presentation"');
    expect(result.html).not.toContain('Si le bouton ne fonctionne pas');
  });
  it('échappe l’objet, le contenu, le titre, le préheader et le bouton', () => {
    const result = createBrumeEmail(
      {
        subject: '<img src=x>',
        title: '<script>alert(1)</script>',
        content: '<b>Bonjour</b> & bienvenue',
        preheader: '<img src=x onerror=alert(1)>',
        action: {
          label: '<img src=x>',
          url: 'https://brume.example/compte?a=1&b=2',
        },
      },
      frontend,
    );
    expect(result.html).not.toMatch(/<script|<img|<b>/);
    expect(result.html).toContain('&lt;b&gt;Bonjour&lt;/b&gt; &amp; bienvenue');
    expect(result.html).toContain('a=1&amp;b=2');
    expect(result.text).toContain('https://brume.example/compte?a=1&b=2');
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    '/compte',
    'https://user:secret@brume.example',
    'https://brume.example/with space',
  ])('refuse le lien %s', (url) => {
    expect(() =>
      createBrumeEmail(
        { ...base, action: { label: 'Continuer', url } },
        frontend,
      ),
    ).toThrow();
  });
  it.each([
    { subject: '' },
    { subject: 'Injected\r\nBcc: someone@example.com' },
    { subject: 'x'.repeat(201) },
    { content: '   ' },
    { content: 'x'.repeat(20001) },
    { title: '' },
    { preheader: '' },
    { action: { label: '', url: frontend } },
  ])('refuse les champs invalides %j', (patch) => {
    expect(() => createBrumeEmail({ ...base, ...patch }, frontend)).toThrow();
  });
  it('réutilise la structure pour les emails génériques sans changer les modèles métier', () => {
    const generic = renderEmail('email.generic', { generic: base }, frontend);
    expect(generic.subject).toBe(base.subject);
    const order = renderEmail(
      'order.confirmed',
      {
        orderId: '123',
        generic: { subject: 'secret', content: 'foreign-payload' },
      },
      frontend,
    );
    expect(order.subject).toBe('Brume — Confirmation de commande');
    expect(JSON.stringify(order)).not.toContain('foreign-payload');
    for (const kind of ['account.confirm', 'account.reset'] as const) {
      const email = renderEmail(kind, { token: 'demo-token' }, frontend);
      expect(email.html).toContain('#f4f1eb');
      expect(email.html).toContain('#token=demo-token');
    }
  });
});
