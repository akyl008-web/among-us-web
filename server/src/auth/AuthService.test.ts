import { describe, expect, it } from 'vitest';
import { AuthService } from './AuthService.js';

const SECRET = 'x'.repeat(40);

describe('AuthService', () => {
  it('hashes passwords with a salt and verifies them', async () => {
    const auth = new AuthService(SECRET);
    const a = await auth.hashPassword('correct horse');
    const b = await auth.hashPassword('correct horse');
    expect(a).not.toBe(b);
    expect(a).not.toContain('correct horse');
    expect(await auth.verifyPassword('correct horse', a)).toBe(true);
    expect(await auth.verifyPassword('wrong', a)).toBe(false);
  });

  it('issues tokens that cannot be forged or used after expiry', () => {
    let now = 0;
    const auth = new AuthService(SECRET, () => now);
    const token = auth.issueToken('user-1');
    expect(auth.verifyToken(token)).toBe('user-1');
    expect(new AuthService('y'.repeat(40)).verifyToken(token)).toBeNull();
    const [body] = token.split('.');
    expect(auth.verifyToken(`${body}.forged`)).toBeNull();
    now = 8 * 24 * 60 * 60 * 1000;
    expect(auth.verifyToken(token)).toBeNull();
  });
});
