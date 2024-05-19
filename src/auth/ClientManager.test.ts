import { ClientManager } from './ClientManager';
import type { ClientConfig } from './ClientConfig';

const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  app_id: "app_id",
  client_id: "123",
  client_secret: "secret",
  callback: "https://callback",
};

describe('ClientManager', () => {
  let clientManager: ClientManager;
  let config1: ClientConfig;
  let config2: ClientConfig;
  let config3: ClientConfig;

  beforeEach(() => {
    clientManager = new ClientManager();
    config1 = { ...DEFAULT_CLIENT_CONFIG, app_id: 'app1', expiration: Date.now() + 10000 }; // expires in 10 seconds
    config2 = { ...DEFAULT_CLIENT_CONFIG, app_id: 'app2' }; // no expiration
    config3 = { ...DEFAULT_CLIENT_CONFIG, app_id: 'app3', expiration: Date.now() - 10000 }; // expired 10 seconds ago
  });

  test('should add client configurations', () => {
    clientManager.addClientConfig(config1);
    clientManager.addClientConfig(config2);
    expect(clientManager.clientConfigs).toContain(config1);
    expect(clientManager.clientConfigs).toContain(config2);
  });

  test('should remove client configuration', () => {
    clientManager.addClientConfig(config1);
    clientManager.addClientConfig(config2);
    clientManager.removeClientConfig(config1);
    expect(clientManager.clientConfigs).not.toContain(config1);
    expect(clientManager.clientConfigs).toContain(config2);
  });

  test('should remove expired client configurations', () => {
    clientManager.addClientConfig(config1);
    clientManager.addClientConfig(config2);
    clientManager.addClientConfig(config3);
    clientManager.removeExpiredConfigs();
    expect(clientManager.clientConfigs).toContain(config1);
    expect(clientManager.clientConfigs).toContain(config2);
    expect(clientManager.clientConfigs).not.toContain(config3);
  });

  test('should find client configuration by app_id', () => {
    clientManager.addClientConfig(config1);
    clientManager.addClientConfig(config2);
    clientManager.addClientConfig(config3);
    expect(clientManager.findClientConfig('app1')).toBe(config1);
    expect(clientManager.findClientConfig('app2')).toBe(config2);
    expect(clientManager.findClientConfig('app3')).toBeUndefined(); // config3 is expired
  });

  test('should return undefined if app_id not found', () => {
    clientManager.addClientConfig(config1);
    clientManager.addClientConfig(config2);
    expect(clientManager.findClientConfig('nonexistent')).toBeUndefined();
  });
});
