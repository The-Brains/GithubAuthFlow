import type { Express } from "express";
import { GithubAuth } from "./GithubAuth";
import type { ClientConfig } from "./ClientConfig";

interface LoginQuery {
  githubUsername?: string;
  app_id?: string;
  allow_signup?: string;
  scope?: string;
}

interface AuthQuery {
  app_id?: string;
  state: string;
  code: string;
}

interface ClientRegistrationQuery {
  app_id?: string;
  client_id?: string;
  client_secret?: string;
  oneTime?: string;
  callback?: string;
}

interface Props {
  clientConfigs?: ClientConfig[];
  rootPath?: string;
  loginPath?: string;
  authPath?: string;
  infoPath?: string;
  resultPath?: string;
  registerClientPath?: string;
}

const ONE_TIME_CLIENT_EXPIRATION_MS = 60000;

export class GithubAuthServer {
  githubAuth = new GithubAuth();
  active = true;

  constructor(app: Express, {
    clientConfigs,
    rootPath = "/",
    loginPath = "github/login/",
    authPath = "github/auth/",
    infoPath = "github/",
    resultPath = "github/result/",
    registerClientPath = "github/register-client/",
  }: Props = {}) {
    clientConfigs?.forEach(config => this.githubAuth.addClientConfig(config));

    app.get(`${rootPath}${infoPath}`, (req, res, next) => {
      if (!this.active) {
        next();
        return;
      }
      const host = `${req.protocol ?? "http"}://${req.headers.host}`;
      res.json({
        host,
        clients: this.githubAuth.getClientInfo({
          host, loginPath: `${rootPath}${loginPath}`, authPath: `${rootPath}${authPath}`,
        }),
      });
    });

    app.get(`${rootPath}${loginPath}`, (req, res, next) => {
      if (!this.active) {
        next();
        return;
      }
      const app_id = req.query.app as string;
      if (!app_id) {
        res.status(400).send({
          message: 'Missing "?app=" parameter.'
         });
      }
      const host = `${req.protocol ?? "http"}://${req.headers.host}`;
      const query = req.query as unknown as LoginQuery;
      const redirect_uri = `${host}${rootPath}${authPath}?app=${app_id}`;
      try {
        const authUrl = this.githubAuth.getAuthUrl({
          app_id,
          redirect_uri,
          login: query.githubUsername,
          allow_signup: query.allow_signup,
          scope: query.scope,
        });
        if (authUrl) {
          res.redirect(authUrl);
        } else {
          res.status(400).send({
            message: 'Unable to login.'
         });
        }  
      } catch (e) {
        res.status(404).json({
          success: false,
          message: `${e}`,
        });
        return;
      }
    });

    app.get(`${rootPath}${authPath}`, async (req, res, next) => {
      if (!this.active) {
        next();
        return;
      }
      const app_id = req.query.app as string;
      if (!app_id) {
        res.status(400).send({
          message: 'Missing "?app=" parameter.'
         });
      }
      const query = req.query as unknown as AuthQuery;

      const result = await this.githubAuth.fetchCallbackWithAuthToken({
        code: query.code,
        state: query.state,
        app_id,
      });
      if (result) {
        res.redirect(result);
      } else {
        res.status(404).send("Unable to get auth token.");
      }
    });

    app.get(`${rootPath}${resultPath}`, (req, res, next) => {
      if (!this.active) {
        next();
        return;
      }
      res.json({
        success: true,
        ...req.query,
      });
    });

    app.get(`${rootPath}${registerClientPath}`, (req, res, next) => {
      if (!this.active) {
        next();
        return;
      }
      const query = req.query;
      const { app_id, client_secret, client_id, oneTime, callback } = query as ClientRegistrationQuery;
      if (!app_id || !client_id || !client_secret || !callback) {
        res.status(404).json({
          success: false,
          message: `Unable to register app "${app_id}". You need to specify all app_id, client_id, client_secret and callback`,
        });
        return;
      }
      const oneTimeUse = oneTime !== "false";
      this.githubAuth.addClientConfig({
        app_id,
        client_id,
        client_secret,
        callback,
        oneTime: oneTimeUse,
        expiration: oneTimeUse ? Date.now() + ONE_TIME_CLIENT_EXPIRATION_MS : undefined,
      });
      res.json({
        success: true,
        client: {
          app_id,
          oneTime: oneTimeUse,
        },
      });
    });
  }
}
