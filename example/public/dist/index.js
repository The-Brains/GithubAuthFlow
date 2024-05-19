// ../src/auth/ClientManager.ts
class ClientManager {
  clientConfigs = [];
  addClientConfig(config) {
    this.clientConfigs.push(config);
  }
  removeClientConfig(config) {
    this.clientConfigs = this.clientConfigs.filter((c) => c !== config);
  }
  removeExpiredConfigs() {
    this.clientConfigs = this.clientConfigs.filter((c) => !c.expiration || Date.now() < c.expiration);
  }
  findClientConfig(app_id) {
    this.removeExpiredConfigs();
    const app_index = this.clientConfigs.findIndex((config) => app_id == config.app_id);
    return app_index >= 0 ? this.clientConfigs[app_index] : undefined;
  }
  saveToLocalStorage() {
    localStorage.setItem("githubAuthClients", JSON.stringify(this.clientConfigs));
  }
  restoreFromLocalStorage() {
    const clientsJson = localStorage.getItem("githubAuthClients") ?? "[]";
    this.clientConfigs = JSON.parse(clientsJson);
  }
}

// ../src/auth/GithubAuth.ts
var AUTH_URL = "https://github.com/login/oauth/authorize";
var ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

class GithubAuth {
  clientManager = new ClientManager;
  getState(clientConfig) {
    return `${clientConfig.app_id}-state`;
  }
  validateState(state, clientConfig) {
    return state === this.getState(clientConfig);
  }
  getAuthUrl({
    scope,
    redirect_uri,
    login,
    allow_signup,
    app_id
  }) {
    const clientConfig = this.clientManager.findClientConfig(app_id);
    if (!clientConfig) {
      throw new Error("Unable to use client config. Specify a correct app_id.");
    }
    const params = new URLSearchParams({
      client_id: clientConfig.client_id,
      state: this.getState(clientConfig),
      redirect_uri,
      allow_signup: allow_signup ?? "true"
    });
    if (login) {
      params.set("login", login);
    }
    if (scope) {
      params.set("scope", scope);
    }
    return `${AUTH_URL}?${params}`;
  }
  getAuthTokenFetchUrl({ code, client_id, client_secret }) {
    const params = new URLSearchParams({
      client_id,
      client_secret,
      code
    });
    return `${ACCESS_TOKEN_URL}?${params}`;
  }
  async fetchCallbackWithAuthToken({ code, state, app_id }, cors) {
    const clientConfig = this.clientManager.findClientConfig(app_id);
    if (!clientConfig) {
      throw new Error("Invalid app_id");
    }
    if (clientConfig.oneTime) {
      this.clientManager.removeClientConfig(clientConfig);
    }
    if (!this.validateState(state, clientConfig)) {
      throw new Error("State doesn't match.");
    }
    const url = this.getAuthTokenFetchUrl({
      code,
      client_id: clientConfig.client_id,
      client_secret: clientConfig.client_secret
    });
    if (!url) {
      return;
    }
    const response = await fetch(cors ? `https://cors-anywhere.herokuapp.com/${url}` : url, {
      method: "POST",
      headers: {
        Accept: "application/json"
      }
    });
    const result = await response.json();
    const params = new URLSearchParams(!result ? { success: "false" } : {
      access_token: result.access_token ?? "",
      expires_in: result.expires_in ?? "",
      refresh_token: result.refresh_token ?? "",
      refresh_token_expires_in: result.refresh_token_expires_in ?? "",
      scope: result.scope ?? "",
      token_type: result.token_type ?? ""
    });
    return `${clientConfig.callback}?${params}`;
  }
  getClientInfo({
    host,
    loginPath,
    authPath
  }) {
    return this.clientManager.clientConfigs.map((client) => ({
      app_id: client.app_id,
      loginUrl: `${host}${loginPath}?app=${client.app_id}`,
      authUrl: `${host}${authPath}?app=${client.app_id}`,
      callbackUrl: client.callback,
      oneTime: client.oneTime
    }));
  }
  addClientConfig(config) {
    this.clientManager.clientConfigs.push(config);
  }
  openLoginPage(loginParam, newWindow) {
    const url = this.getAuthUrl(loginParam);
    if (url) {
      if (newWindow) {
        open(url);
      } else {
        location.href = url;
      }
      return true;
    }
    return false;
  }
  redirectLoginPage() {
    const params = new URLSearchParams(location.search);
    const app_id = params.get("app");
    if (app_id) {
      this.openLoginPage({ app_id, redirect_uri: `${location.protocol}//${location.host}${location.pathname.replace("/github/login/", "/github/auth/")}?app=${app_id}` });
    } else {
      console.warn("Missing ?app= parameter");
    }
  }
  async redirectAuthPage(saveToLocalStorage, newWindow) {
    const params = new URLSearchParams(location.search);
    const app_id = params.get("app");
    const code = params.get("code");
    const state = params.get("state");
    if (app_id && code && state) {
      const url = await this.fetchCallbackWithAuthToken({ app_id, code, state }, true);
      if (saveToLocalStorage) {
        this.clientManager.saveToLocalStorage();
      }
      if (url) {
        if (newWindow) {
          open(url);
        } else {
          location.href = url;
        }
      } else {
        console.warn("Unable to redirect with app=" + app_id);
      }
    } else {
      console.warn("Missing parameters. app, code and state required");
    }
  }
}

// ../src/auth/GithubAuthServer.ts
var ONE_TIME_CLIENT_EXPIRATION_MS = 60000;

class GithubAuthServer {
  githubAuth = new GithubAuth;
  active = true;
  constructor(app, {
    clientConfigs,
    rootPath = "/",
    loginPath = "github/login/",
    authPath = "github/auth/",
    infoPath = "github/",
    resultPath = "github/result/",
    registerClientPath = "github/register-client/"
  } = {}) {
    clientConfigs?.forEach((config) => this.githubAuth.addClientConfig(config));
    app.get(`${rootPath}${infoPath}`, (req, res, next) => {
      if (!this.active) {
        next();
        return;
      }
      const host = `${req.protocol ?? "http"}://${req.headers.host}`;
      res.json({
        host,
        clients: this.githubAuth.getClientInfo({
          host,
          loginPath: `${rootPath}${loginPath}`,
          authPath: `${rootPath}${authPath}`
        })
      });
    });
    app.get(`${rootPath}${loginPath}`, (req, res, next) => {
      if (!this.active) {
        next();
        return;
      }
      const app_id = req.query.app;
      if (!app_id) {
        res.status(400).send({
          message: 'Missing "?app=" parameter.'
        });
      }
      const host = `${req.protocol ?? "http"}://${req.headers.host}`;
      const query = req.query;
      const redirect_uri = `${host}${rootPath}${authPath}?app=${app_id}`;
      try {
        const authUrl = this.githubAuth.getAuthUrl({
          app_id,
          redirect_uri,
          login: query.githubUsername,
          allow_signup: query.allow_signup,
          scope: query.scope
        });
        if (authUrl) {
          res.redirect(authUrl);
        } else {
          res.status(400).send({
            message: "Unable to login."
          });
        }
      } catch (e) {
        res.status(404).json({
          success: false,
          message: `${e}`
        });
        return;
      }
    });
    app.get(`${rootPath}${authPath}`, async (req, res, next) => {
      if (!this.active) {
        next();
        return;
      }
      const app_id = req.query.app;
      if (!app_id) {
        res.status(400).send({
          message: 'Missing "?app=" parameter.'
        });
      }
      const query = req.query;
      const result = await this.githubAuth.fetchCallbackWithAuthToken({
        code: query.code,
        state: query.state,
        app_id
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
        ...req.query
      });
    });
    app.get(`${rootPath}${registerClientPath}`, (req, res, next) => {
      if (!this.active) {
        next();
        return;
      }
      const query = req.query;
      const { app_id, client_secret, client_id, oneTime, callback } = query;
      if (!app_id || !client_id || !client_secret || !callback) {
        res.status(404).json({
          success: false,
          message: `Unable to register app "${app_id}". You need to specify all app_id, client_id, client_secret and callback`
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
        expiration: oneTimeUse ? Date.now() + ONE_TIME_CLIENT_EXPIRATION_MS : undefined
      });
      res.json({
        success: true,
        client: {
          app_id,
          oneTime: oneTimeUse
        }
      });
    });
  }
}

// src/index.ts
function appRegister(client) {
  const githubAuth = new GithubAuth;
  githubAuth.addClientConfig({
    ...client,
    oneTime: true,
    expiration: Date.now() + 60000
  });
  githubAuth.clientManager.saveToLocalStorage();
}
function redirectLoginPage() {
  githubAuth.redirectLoginPage();
}
async function redirectAuthPage() {
  githubAuth.redirectAuthPage(true);
}
var githubAuth = new GithubAuth;
githubAuth.clientManager.restoreFromLocalStorage();
export {
  redirectLoginPage,
  redirectAuthPage,
  appRegister
};
