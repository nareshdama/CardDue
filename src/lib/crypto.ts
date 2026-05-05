import CryptoJS from 'crypto-js';

// Default iterations for new vaults. Existing vaults persist their
// iteration count in localStorage so older accounts keep working.
export const DEFAULT_PBKDF2_ITERATIONS = 100_000;
export const LEGACY_PBKDF2_ITERATIONS = 10_000;

export const generateSalt = (): string => {
  return CryptoJS.lib.WordArray.random(128 / 8).toString();
};

export const hashPassword = (password: string, salt: string): string => {
  return CryptoJS.SHA256(password + salt).toString();
};

export const deriveKey = (
  password: string,
  salt: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS
): string => {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations,
  }).toString();
};

export const encryptData = (data: any, key: string): string => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
};

export const decryptData = (ciphertext: string, key: string): any => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedStr);
  } catch (e) {
    const cause = e instanceof Error ? e.message : 'unknown error';
    throw new Error(`Decryption failed: ${cause}`);
  }
};
