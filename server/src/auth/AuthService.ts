import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface TokenPayload {
  sub: string; // user id
  exp: number; // ms epoch
}

/**
 * Password hashing (scrypt, built into Node — no native addons, works on Windows)
 * and signed session tokens (HMAC-SHA256, JWT-like but minimal).
 */
export class AuthService {
  constructor(
    private readonly secret: string,
    private readonly now: () => number = Date.now,
  ) {
    if (secret.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
  }

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, SCRYPT.keylen, {
      N: SCRYPT.N,
      r: SCRYPT.r,
      p: SCRYPT.p,
    });
    return [
      'scrypt',
      SCRYPT.N,
      SCRYPT.r,
      SCRYPT.p,
      salt.toString('base64url'),
      key.toString('base64url'),
    ].join('$');
  }

  async verifyPassword(password: string, stored: string): Promise<boolean> {
    const [algo, n, r, p, saltB64, keyB64] = stored.split('$');
    if (algo !== 'scrypt' || !n || !r || !p || !saltB64 || !keyB64) return false;
    const expected = Buffer.from(keyB64, 'base64url');
    const actual = await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  issueToken(userId: string): string {
    const payload: TokenPayload = { sub: userId, exp: this.now() + TOKEN_TTL_MS };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.sign(body)}`;
  }

  /** Returns the user id, or null for a forged/expired/malformed token. */
  verifyToken(token: unknown): string | null {
    if (typeof token !== 'string' || token.length > 1024) return null;
    const [body, signature] = token.split('.');
    if (!body || !signature) return null;
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as Partial<TokenPayload>;
      if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
      return payload.exp > this.now() ? payload.sub : null;
    } catch {
      return null;
    }
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}
