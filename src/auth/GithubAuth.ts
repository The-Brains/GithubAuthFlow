// To recognize dom types (see https://bun.sh/docs/typescript#dom-types):
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import type { ClientConfig } from "./ClientConfig";
import { ClientManager } from "./ClientManager";

interface LoginParam {
  app_id: string;
  redirect_uri: string;
  login?: string;
  allow_signup?: string;
  scope?: string;
}

interface RedirectParam {
  code: string;
  client_id: string;
  client_secret: string;
}

interface AuthResult {
  access_token?: string;
  expires_in?: string;
  refresh_token?: string;
  refresh_token_expires_in?: string;
  scope?: string;
  token_type?: string;
  [key: string]: string | undefined;
}

export const AUTH_URL = "https://github.com/login/oauth/authorize";
export const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

/**
 * This class handles the Github authentication flow.
 */
export class GithubAuth {
  readonly clientManager = new ClientManager();

  /**
   * Generate the state to be passed and checked.
   */
  getState(clientConfig: ClientConfig) {
    return `${clientConfig.app_id}-state`;
  }

  /**
   * Validate state
   */
  validateState(state: string, clientConfig: ClientConfig) {
    return state === this.getState(clientConfig);
  }

  /**
   * This function prepares a URL that can be shown in a browser to allow login into Github
   * 
   * @param redirect_uri The uri to redirect to
   * @param login The github username pre-filled in the login window
   * @returns A url where the user can enter credentials to login into Github
   */
  getAuthUrl({
      scope,
      redirect_uri,
      login,
      allow_signup,
      app_id,
    }: LoginParam) {
    const clientConfig = this.clientManager.findClientConfig(app_id);
    if (!clientConfig) {
      throw new Error("Unable to use client config. Specify a correct app_id.");
    }
    const params = new URLSearchParams({
      client_id: clientConfig.client_id,
      state: this.getState(clientConfig),
      redirect_uri,
      allow_signup: allow_signup ?? "true",
    });
    if (login) {
      params.set("login", login);
    }
    if (scope) {
      params.set("scope", scope);
    }
    return `${AUTH_URL}?${params}`;
  }

  /**
   * Returns the URL to be sent to in order to retrieve the auth token.
   *
   * @param code Code passed after the login page has redirected.
   * @param redirect_uri Url to redirect to after the auth_token was retrieved.
   * @returns A url to be sent to in order to retrieve the auth token.
   * Note: This code uses client_secret, so it shouldn't be used in a browser.
   */
  getAuthTokenFetchUrl({ code, client_id, client_secret }: RedirectParam) {
    const params = new URLSearchParams({
      client_id,
      client_secret,
      code,
    });
    return `${ACCESS_TOKEN_URL}?${params}`;
  }

  /**
   * Call the Github URL to fetch the auth token.
   * This is expected to be called from a Node.js server
   * 
   * @param redirectParam see getRedirectURl
   * @returns the response from github including the auth_token
   */
  async fetchCallbackWithAuthToken({ code, state, app_id }: { code: string; state: string;  app_id: string; },
    cors?: boolean
  ): Promise<string|undefined> {
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
      client_secret: clientConfig.client_secret,
    });
    if (!url) {
      return;
    }

    const response = await fetch(cors ? `https://cors-anywhere.herokuapp.com/${url}` :url, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });
    const result: AuthResult = await response.json();
    const params = new URLSearchParams(!result ? { success: "false" }: {
      access_token: result.access_token ?? "",
      expires_in: result.expires_in ?? "",
      refresh_token: result.refresh_token ?? "",
      refresh_token_expires_in: result.refresh_token_expires_in ?? "",
      scope: result.scope ?? "",
      token_type: result.token_type ?? "",
    });

    return `${clientConfig.callback}?${params}`;
  }

  /**
   * Retrieve client informations.
   */
  getClientInfo({
    host,
    loginPath,
    authPath
  }: {
    host: string;
    loginPath: string;
    authPath: string;
  }) {
    return this.clientManager.clientConfigs.map(client => ({
      app_id: client.app_id,
      loginUrl: `${host}${loginPath}?app=${client.app_id}`,
      authUrl: `${host}${authPath}?app=${client.app_id}`,
      callbackUrl: client.callback,
      oneTime: client.oneTime,
    }));
  }

  /**
   * Add client configuration
   */
  addClientConfig(config: ClientConfig) {
    this.clientManager.clientConfigs.push(config);
  }

  /**
   * Open the Github login page to enable login into Github.
   * You don't need to call this when running this code on a server.
   * This is used in case you want to perform the first part of the login on the
   * client side.
   *
   * @param loginParam parameters used for login. See getAuthUrl.
   * @returns true if we're able to open the login page, false otherwise.
   */
  openLoginPage(loginParam: LoginParam, newWindow?: boolean) {
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

  /**
   * Parse the login parameters and use it to redirect to the Github login
   */
  redirectLoginPage() {
    const params = new URLSearchParams(location.search);
    const app_id = params.get("app");
    if (app_id) {
      this.openLoginPage({ app_id, redirect_uri: `${location.protocol}//${location.host}${location.pathname.replace("login", "auth")}?app=${app_id}` });
    } else {
      console.warn("Missing ?app= parameter");
    }
  }

  async redirectAuthPage(saveToLocalStorage?: boolean, newWindow?: boolean) {
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
        console.warn("Unable to redirect with app="+ app_id);
      }
    } else {
      console.warn("Missing parameters. app, code and state required");
    }
  }
}
