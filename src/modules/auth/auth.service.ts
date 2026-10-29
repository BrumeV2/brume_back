import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { authenticationFailed, UsersService } from '../users/users.service';
import { AuthConfig } from './auth.config';
import { hashToken, isToken, randomToken } from './crypto.util';
import { OAuthTransaction } from './entities/oauth-transaction.entity';
import { GoogleIdentityProvider } from './google.provider';
import { SessionsService } from './sessions.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(OAuthTransaction)
    private readonly transactions: Repository<OAuthTransaction>,
    private readonly google: GoogleIdentityProvider,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly config: AuthConfig,
  ) {}

  async start() {
    const state = randomToken();
    const browser = randomToken();
    const nonce = randomToken();
    const verifier = randomToken();
    const location = this.google.authorizationUrl(state, nonce, verifier);
    await this.transactions.insert({
      stateHash: hashToken(state),
      browserHash: hashToken(browser),
      nonce,
      codeVerifier: verifier,
      expiresAt: new Date(Date.now() + this.config.transactionTtl * 1000),
    });
    return { browser, location };
  }

  async finish(browser: string | undefined, query: Record<string, unknown>) {
    const { state, code, error } = query;
    if (!isToken(browser) || !isToken(state)) throw authenticationFailed();
    // Atomic consume: a callback can be processed at most once, including across replicas.
    const result = await this.transactions
      .createQueryBuilder()
      .delete()
      .where({
        stateHash: hashToken(state),
        browserHash: hashToken(browser),
        expiresAt: MoreThan(new Date()),
      })
      .returning(['nonce', 'codeVerifier'])
      .execute();
    const transaction = (
      result.raw as { nonce: string; code_verifier: string }[]
    )[0];
    if (
      !transaction ||
      error !== undefined ||
      typeof code !== 'string' ||
      !code ||
      code.length > 4096
    )
      throw authenticationFailed();
    const identity = await this.google.exchange(
      code,
      transaction.nonce,
      transaction.code_verifier,
    );
    const user = await this.users.resolveGoogle(identity);
    return this.sessions.create(user);
  }
}
