import type { Express } from "express";
import { GithubAuth } from "./GithubAuth";
import type { ClientConfig } from "./ClientConfig";

interface LoginQuery {
  githubUsername?: string;
  app_id?: string;
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
  clientConfigs: ClientConfig[];
  loginPath?: string;
  authPath?: string;
  infoPath?: string;
  resultPath?: string;
  registerClientPath?: string;
}

const ONE_TIME_CLIENT_EXPIRATION_MS = 60000;

export class GithubAuthServer {
  githubAuth = new GithubAuth();

  constructor(app: Express, {
    clientConfigs,
    loginPath = "/github/login",
    authPath = "/github/auth",
    infoPath = "/github",
    resultPath = "/github/result",
    registerClientPath = "/github/register-client",
  }: Props = {
    clientConfigs: [],
  }) {
    clientConfigs.forEach(config => this.githubAuth.addClientConfig(config));

    app.get(infoPath, (req, res) => {
      const host = `${req.protocol ?? "http"}://${req.headers.host}`;
      res.json({
        host,
        clients: this.githubAuth.getClientInfo({
          host, loginPath, authPath,
        }),
      });
    });

    app.get(`${loginPath}/:app_id`, (req, res) => {
      const app_id = req.params.app_id;
      const host = `${req.protocol ?? "http"}://${req.headers.host}`;
      const query = req.query as unknown as LoginQuery;
      const redirect_uri = `${host}${authPath}/${app_id}`;
      try {
        const authUrl = this.githubAuth.getAuthUrl({
          app_id,
          redirect_uri,
          login: query.githubUsername,
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

    app.get(`${authPath}/:app_id`, async (req, res) => {
      const app_id = req.params.app_id;
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

    app.get(resultPath, (req, res) => {
      res.json({
        success: true,
        ...req.query,
      });
    });

    app.get(registerClientPath, (req, res) => {
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
