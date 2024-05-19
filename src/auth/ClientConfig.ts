export interface ClientConfig {
  app_id: string;
  client_id: string;
  client_secret: string;
  callback: string;
  oneTime?: boolean;
  expiration?: number;
}
