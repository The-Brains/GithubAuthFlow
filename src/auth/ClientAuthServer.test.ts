import express, { Express } from "express";
import request from "supertest";
import { GithubAuthServer } from "./GithubAuthServer";
import { GithubAuth } from "./GithubAuth";
import type { ClientConfig } from "./ClientConfig";

describe('GithubAuthServer', () => {
  let app: Express;
  let githubAuthServer: GithubAuthServer;
  let githubAuth: GithubAuth;
  let clientConfig: ClientConfig;

  beforeEach(() => {
    app = express();
    githubAuth = new GithubAuth();
    githubAuthServer = new GithubAuthServer(app, {
      clientConfigs: [clientConfig],
    });

    // Inject the real GithubAuth instance
    githubAuthServer.githubAuth = githubAuth;

    clientConfig = {
      app_id: 'app1',
      client_id: 'client1',
      client_secret: 'secret1',
      callback: 'http://localhost/callback',
      expiration: Date.now() + 10000,
    };

    githubAuth.addClientConfig(clientConfig);
  });

  test('GET /github should return host and client info', async () => {
    const response = await request(app).get('/github')
      .set('Host', 'localhost');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('host');
    expect(response.body).toHaveProperty('clients');
    expect(response.body.clients).toEqual([{
      app_id: 'app1',
      loginUrl: 'http://localhost/github/login/app1',
      authUrl: 'http://localhost/github/auth/app1',
      callbackUrl: 'http://localhost/callback',
      oneTime: undefined,
    }]);
  });

  test('GET /github/login/:app_id should redirect to auth URL', async () => {
    const authUrl = githubAuth.getAuthUrl({
      app_id: clientConfig.app_id,
      redirect_uri: `http://localhost/github/auth/${clientConfig.app_id}`,
    });

    const response = await request(app).get(`/github/login/${clientConfig.app_id}`)
      .set('Host', 'localhost');;
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(authUrl);
  });

  test('GET /github/login/:app_id should return 404 if app_id is invalid', async () => {
    const response = await request(app).get('/github/login/invalid');
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  });

  test('GET /github/auth/:app_id should redirect to result URL with auth token', async () => {
    const fetchCallbackWithAuthTokenMock = jest.spyOn(githubAuth, 'fetchCallbackWithAuthToken').mockResolvedValue('http://localhost/github/result?access_token=token123');

    const response = await request(app).get(`/github/auth/${clientConfig.app_id}?state=state123&code=code123`);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('http://localhost/github/result?access_token=token123');

    fetchCallbackWithAuthTokenMock.mockRestore();
  });

  test('GET /github/auth/:app_id should return 404 if unable to get auth token', async () => {
    const fetchCallbackWithAuthTokenMock = jest.spyOn(githubAuth, 'fetchCallbackWithAuthToken').mockResolvedValue(undefined);

    const response = await request(app).get(`/github/auth/${clientConfig.app_id}?state=state123&code=code123`);
    expect(response.status).toBe(404);
    expect(response.text).toBe("Unable to get auth token.");

    fetchCallbackWithAuthTokenMock.mockRestore();
  });

  test('GET /github/result should return success true with query params', async () => {
    const response = await request(app).get('/github/result?access_token=token123');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('access_token', 'token123');
  });

  test('GET /github/register-client should register a new client', async () => {
    const response = await request(app).get('/github/register-client?app_id=app2&client_id=client2&client_secret=secret2&callback=http://localhost/callback2&oneTime=true');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.client).toHaveProperty('app_id', 'app2');
    expect(response.body.client).toHaveProperty('oneTime', true);
  });

  test('GET /github/register-client should return 404 if required params are missing', async () => {
    const response = await request(app).get('/github/register-client?app_id=app2&client_id=client2&callback=http://localhost/callback2');
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Unable to register app "app2". You need to specify all app_id, client_id, client_secret and callback');
  });
});
