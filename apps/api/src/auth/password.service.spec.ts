import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('uses salted Argon2id with the documented work factors', async () => {
    const password = 'a long passphrase with spaces ';
    const first = await passwords.hash(password);
    const second = await passwords.hash(password);
    expect(first).toContain('$argon2id$v=19$m=19456,t=2,p=1$');
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await passwords.verify(first, password)).toBe(true);
    expect(await passwords.verify(first, password.trim())).toBe(false);
    expect(await passwords.verify(first, 'incorrect password')).toBe(false);
  });

  it('rejects invalid stored hashes safely', async () => {
    expect(await passwords.verify('invalid', 'a long passphrase')).toBe(false);
  });
});
