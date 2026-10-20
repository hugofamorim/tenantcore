import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hash(password, {
      algorithm: 2, // Argon2id; the package's ambient const enum cannot be used with isolatedModules.
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
  }

  async verify(encoded: string, password: string): Promise<boolean> {
    try {
      return await verify(encoded, password);
    } catch {
      return false;
    }
  }
}
