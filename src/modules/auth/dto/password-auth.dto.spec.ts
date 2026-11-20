import { validateSync } from 'class-validator';
import { LoginDto, RegisterDto, ResetPasswordDto } from './password-auth.dto';

for (const Dto of [RegisterDto, ResetPasswordDto]) {
  describe(Dto.name, () => {
    const errors = (password: unknown) =>
      validateSync(
        Object.assign(new Dto(), {
          email: 'client@example.com',
          token: 'a'.repeat(43),
          password,
        }),
      ).filter((error) => error.property === 'password');
    it.each(['Abcdef1!', 'ABCDEFG1!', 'Ébcdef1!', 'Abcdef1💧'])(
      'accepte %s sans imposer de minuscule',
      (password) => {
        expect(errors(password)).toHaveLength(0);
      },
    );
    it.each([
      ['Abcde1!', 'moins de 8 caractères'],
      ['abcdef1!', 'aucune majuscule'],
      ['Abcdefg!', 'aucun chiffre'],
      ['Abcdef12', 'aucun caractère spécial'],
      ['Abcdef1 ', 'un espace ne remplace pas un caractère spécial'],
      ['Abcdef1é', 'une lettre accentuée ne remplace pas un caractère spécial'],
      ['Abcdef1!' + 'x'.repeat(121), 'plus de 128 caractères'],
      [null, 'valeur non textuelle'],
    ])('refuse %s : %s', (password) => {
      expect(errors(password).length).toBeGreaterThan(0);
    });
  });
}

describe('LoginDto', () => {
  it('permet de vérifier les mots de passe existants sans imposer rétroactivement les nouvelles règles', () => {
    expect(
      validateSync(
        Object.assign(new LoginDto(), {
          email: 'client@example.com',
          password: 'legacy',
        }),
      ),
    ).toHaveLength(0);
  });
});
