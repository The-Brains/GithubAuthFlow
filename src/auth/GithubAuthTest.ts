import { ACCESS_TOKEN_URL, AUTH_URL, GithubAuth } from './GithubAuth';
import { ClientManager } from './ClientManager';
import type { ClientConfig } from './ClientConfig';
import { describe, beforeEach, test, expect, jest } from "bun:test";

describe('GithubAuth', () => {
  let githubAuth: GithubAuth;
  let clientManager: ClientManager;
  let clientConfig: ClientConfig;

  beforeEach(() => {
    clientManager = new ClientManager();
    githubAuth = new GithubAuth();
    (githubAuth as any).clientManager = clientManager; // Inject real ClientManager

    clientConfig = {
      app_id: 'app1',
      client_id: 'client1',
      client_secret: 'secret1',
      callback: 'http://localhost/callback',
      expiration: Date.now() + 10000,
    };
    clientManager.addClientConfig(clientConfig);
  });

  test('getState should generate state string', () => {
    expect(githubAuth.getState(clientConfig)).toBe('app1-state');
  });

  test('validateState should return true for valid state', () => {
    const state = 'app1-state';
    expect(githubAuth.validateState(state, clientConfig)).toBe(true);
  });

  test('validateState should return false for invalid state', () => {
    const state = 'invalid-state';
    expect(githubAuth.validateState(state, clientConfig)).toBe(false);
  });

  test('getAuthUrl should throw error if client config is not found', () => {
    expect(() => githubAuth.getAuthUrl({
      redirect_uri: 'http://localhost',
      app_id: 'invalid',
    })).toThrowError('Unable to use client config. Specify a correct app_id.');
  });

  test('getAuthUrl should return the correct URL', () => {
    const url = githubAuth.getAuthUrl({
      redirect_uri: 'http://localhost',
      app_id: 'app1',
      scope: 'read:user',
      login: 'testuser',
      allow_signup: 'false',
    });
    expect(url).toContain(AUTH_URL);
    expect(url).toContain('client_id=client1');
    expect(url).toContain('state=app1-state');
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost');
    expect(url).toContain('scope=read%3Auser');
    expect(url).toContain('login=testuser');
    expect(url).toContain('allow_signup=false');
  });

  test('openLoginPage should set location.href correctly', () => {
    const loginParam = {
      redirect_uri: 'http://localhost',
      app_id: 'app1',
    };
    const url = githubAuth.getAuthUrl(loginParam);
    delete (global as any).location;
    (global as any).location = { href: '' };
    const result = githubAuth.openLoginPage(loginParam);
    expect(result).toBe(true);
    expect(location.href).toBe(url);
  });

  test('getRedirectUrl should return the correct URL', () => {
    const url = githubAuth.getRedirectUrl({
      code: 'code123',
      client_id: 'client1',
      client_secret: 'secret1',
    });
    expect(url).toContain(ACCESS_TOKEN_URL);
    expect(url).toContain('client_id=client1');
    expect(url).toContain('client_secret=secret1');
    expect(url).toContain('code=code123');
  });

  test('fetchCallbackWithAuthToken should throw error for invalid app_id', async () => {
    clientManager.removeClientConfig(clientConfig);
    await expect(githubAuth.fetchCallbackWithAuthToken({
      code: 'code123',
      state: 'app1-state',
      app_id: 'invalid',
    })).rejects.toThrowError('Invalid app_id');
  });

  test('fetchCallbackWithAuthToken should throw error for invalid state', async () => {
    await expect(githubAuth.fetchCallbackWithAuthToken({
      code: 'code123',
      state: 'invalid-state',
      app_id: 'app1',
    })).rejects.toThrowError("State doesn't match.");
  });

  test('fetchCallbackWithAuthToken should fetch auth token and return callback URL', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ access_token: 'token123' }),
      })
    ) as jest.Mock;

    const url = await githubAuth.fetchCallbackWithAuthToken({
      code: 'code123',
      state: 'app1-state',
      app_id: 'app1',
    });

    expect(url).toContain(clientConfig.callback);
    expect(url).toContain('access_token=token123');
  });

  test('getClientInfo should return correct client information', () => {
    const clientInfo = githubAuth.getClientInfo({
      host: 'http://localhost',
      loginPath: '/login',
      authPath: '/auth',
    });

    expect(clientInfo).toEqual([{
      app_id: 'app1',
      loginUrl: 'http://localhost/login/app1',
      authUrl: 'http://localhost/auth/app1',
      callbackUrl: clientConfig.callback,
      oneTime: clientConfig.oneTime,
    }]);
  });

  test('addClientConfig should add new client configuration', () => {
    const newClientConfig: ClientConfig = {
      app_id: 'app2',
      client_id: 'client2',
      client_secret: 'secret2',
      callback: 'http://localhost/callback2',
    };
    githubAuth.addClientConfig(newClientConfig);
    expect(clientManager.clientConfigs).toContain(newClientConfig);
  });
});
