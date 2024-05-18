import type { ClientConfig } from "./ClientConfig";

export class ClientManager {
  clientConfigs: ClientConfig[] = [];

  /**
   * Add client configuration
   */
  addClientConfig(config: ClientConfig) {
    this.clientConfigs.push(config);
  }

  /**
   * Remove client configuration
   */
  removeClientConfig(config: ClientConfig) {
    this.clientConfigs = this.clientConfigs.filter(c => c !== config);
  }

  /**
   * Remote temporary client configurations that have expired
   */
  removeExpiredConfigs() {
    this.clientConfigs = this.clientConfigs.filter(c => !c.expiration || Date.now() < c.expiration);
  }

  /**
   * Find the client config from the app_id.
   */
  findClientConfig(app_id?: string): ClientConfig | undefined {
    this.removeExpiredConfigs();
    const app_index = this.clientConfigs.findIndex(config => app_id == config.app_id);
    return app_index >= 0 ? this.clientConfigs[app_index] : undefined;
  }
}
