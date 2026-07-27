const PREFIX = 'pbkdf2-sha256';
const ITERATIONS = 310_000;
const KEY_BYTES = 32;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations },
    material,
    KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

export function isPasswordHash(value: string): boolean {
  return value.startsWith(`${PREFIX}$`);
}

export async function hashPassword(password: string): Promise<string> {
  if (isPasswordHash(password)) return password;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (!isPasswordHash(stored)) return stored === password;
  try {
    const [, iterationsValue, saltValue, hashValue] = stored.split('$');
    const expected = fromBase64(hashValue);
    const actual = await derive(
      password,
      fromBase64(saltValue),
      Number(iterationsValue)
    );
    if (expected.length !== actual.length) return false;
    // subtle.verify provides a timing-safe byte comparison without Node-only APIs.
    const expectedKey = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(expected),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const actualSignature = await crypto.subtle.sign(
      'HMAC',
      await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(actual),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ),
      new Uint8Array()
    );
    return crypto.subtle.verify(
      'HMAC',
      expectedKey,
      actualSignature,
      new Uint8Array()
    );
  } catch {
    return false;
  }
}
