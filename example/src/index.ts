import { GithubAuth } from "simple-github-authentication"

const githubAuth = new GithubAuth();
githubAuth.clientManager.restoreFromLocalStorage();

export function appRegister(client: { app_id: string, callback: string, client_id: string, client_secret: string }) {  const githubAuth = new GithubAuth();
  githubAuth.addClientConfig({
    ...client,
    oneTime: true,
    expiration: Date.now() + 60000,
  });
  githubAuth.clientManager.saveToLocalStorage();
}

export function redirectLoginPage() {
  githubAuth.redirectLoginPage();
}

export async function redirectAuthPage() {
  githubAuth.redirectAuthPage(true);
}
