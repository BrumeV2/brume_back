import { jest } from '@jest/globals';
import { ArgumentsHost, ForbiddenException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter — codes, corrélation et confidentialité', () => {
  afterEach(() => jest.restoreAllMocks());
  function fixture() {
    const headers = new Map<string, string>();
    const json = jest.fn<(body: Record<string, unknown>) => void>();
    const response = {
      getHeader: (key: string) => headers.get(key),
      setHeader: (key: string, value: string) => {
        headers.set(key, value);
        return response;
      },
      status: jest.fn(() => response),
      json,
    };
    const request = {
      method: 'POST',
      originalUrl: '/api/auth/register?token=secret-query',
      route: { path: '/api/auth/register' },
      body: { password: 'secret-password' },
      headers: {
        authorization: 'Bearer secret-bearer',
        cookie: 'secret-cookie',
      },
    } as unknown as Request;
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response as unknown as Response,
      }),
    } as ArgumentsHost;
    return { response, json, headers, host };
  }
  it('journalise un échec serveur avec requestId et code SQL, sans son contenu sensible', () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { json, headers, host } = fixture();
    const failure = Object.assign(new Error('secret-password and SQL values'), {
      driverError: { code: '42P01', detail: 'secret-query' },
    });
    new ApiExceptionFilter().catch(failure, host);
    const body = json.mock.calls[0][0];
    expect(body).toMatchObject({
      statusCode: 503,
      code: 'AUTH_UNAVAILABLE',
      path: '/api/auth/register',
      requestId: headers.get('X-Request-ID'),
    });
    expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/);
    const entry = String(log.mock.calls[0][0]);
    expect(entry).toContain('42P01');
    expect(entry).toContain(String(body.requestId));
    expect(entry + JSON.stringify(body)).not.toMatch(
      /secret-|SQL values|stack/,
    );
  });
  it('conserve un code métier explicite et journalise le refus sans stack', () => {
    const log = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { json, host } = fixture();
    new ApiExceptionFilter().catch(
      new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Cet accès est réservé aux administrateurs.',
      }),
      host,
    );
    expect(json.mock.calls[0][0]).toMatchObject({
      statusCode: 403,
      code: 'ADMIN_REQUIRED',
      message: 'Cet accès est réservé aux administrateurs.',
    });
    expect(String(log.mock.calls[0][0])).toContain('ADMIN_REQUIRED');
  });
});
