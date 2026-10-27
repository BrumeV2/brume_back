import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import type { TokenPayload } from 'google-auth-library';
import type { Credentials } from 'google-auth-library';
import { AuthConfig } from './auth.config';
import { authenticationFailed } from '../users/users.service';
import type { GoogleIdentity } from '../users/users.service';
import { createHash } from 'node:crypto';

export abstract class GoogleIdentityProvider {
  abstract authorizationUrl(
    state: string,
    nonce: string,
    verifier: string,
  ): string;
  abstract exchange(
    code: string,
    nonce: string,
    verifier: string,
  ): Promise<GoogleIdentity>;
}

@Injectable()
export class GoogleOidcProvider implements GoogleIdentityProvider {
  private readonly client: OAuth2Client;

  constructor(private readonly config: AuthConfig) {
    this.client = new OAuth2Client({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      transporterOptions: { timeout: 5000, retry: false },
    });
  }

  authorizationUrl(state: string, nonce: string, verifier: string) {
    this.assertConfigured();
    return this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: CodeChallengeMethod.S256,
      access_type: 'online',
      prompt: 'select_account',
    });
  }

  async exchange(
    code: string,
    nonce: string,
    verifier: string,
  ): Promise<GoogleIdentity> {
    this.assertConfigured();
    let tokens: Credentials;
    try {
      ({ tokens } = await this.client.getToken({
        code,
        codeVerifier: verifier,
        redirect_uri: this.config.redirectUri,
      }));
    } catch (error: unknown) {
      const providerCode = (
        error as { response?: { data?: { error?: string } } }
      )?.response?.data?.error;
      if (
        providerCode === 'invalid_grant' ||
        providerCode === 'invalid_request'
      )
        throw authenticationFailed();
      throw this.unavailable();
    }
    if (!tokens.id_token) throw authenticationFailed();
    let payload: (TokenPayload & { nonce?: string }) | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.config.clientId,
      });
      payload = ticket.getPayload();
    } catch (error: unknown) {
      // Never propagate provider messages: they may contain codes or tokens.
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (
        (status !== undefined && (status === 429 || status >= 500)) ||
        [
          'ENOTFOUND',
          'ETIMEDOUT',
          'ECONNRESET',
          'ECONNREFUSED',
          'EAI_AGAIN',
          'ERR_NETWORK',
        ].includes((error as { code?: string })?.code ?? '') ||
        (error as { name?: string })?.name === 'AbortError'
      ) {
        throw this.unavailable();
      }
      throw authenticationFailed();
    }
    const now = Math.floor(Date.now() / 1000);
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      payload.sub.length > 255 ||
      payload.nonce !== nonce ||
      payload.email_verified !== true ||
      typeof payload.email !== 'string' ||
      !payload.email ||
      payload.email.length > 254 ||
      !isEmail(payload.email) ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= now ||
      !Number.isFinite(payload.iat) ||
      payload.iat > now + 60 ||
      (payload.given_name !== undefined &&
        typeof payload.given_name !== 'string') ||
      (payload.family_name !== undefined &&
        typeof payload.family_name !== 'string') ||
      (payload.azp && payload.azp !== this.config.clientId)
    ) {
      throw authenticationFailed();
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      firstName: payload.given_name?.slice(0, 100) || null,
      lastName: payload.family_name?.slice(0, 100) || null,
    };
  }

  private unavailable() {
    return new ServiceUnavailableException({
      code: 'AUTH_UNAVAILABLE',
      message: 'Service de connexion indisponible. Réessayez.',
    });
  }

  private assertConfigured() {
    if (!this.config.clientId || !this.config.clientSecret)
      throw new ServiceUnavailableException({
        code: 'AUTH_UNAVAILABLE',
        message: 'Service de connexion indisponible.',
      });
  }
}
