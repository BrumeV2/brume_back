import appConfig, { getAppConfig, AppConfig } from './app.config';
import databaseConfig, {
  getDatabaseConfig,
  DatabaseConfig,
} from './database.config';
import { AuthConfig } from './auth.config';
import {
  getRequiredEnv,
  getRequiredEnvNumber,
  getRequiredEnvBoolean,
  parseAbsoluteUrl,
  parseCorsOrigins,
  MissingEnvException,
  InvalidEnvException,
} from './config';

export {
  appConfig,
  getAppConfig,
  databaseConfig,
  getDatabaseConfig,
  AuthConfig,
  getRequiredEnv,
  getRequiredEnvNumber,
  getRequiredEnvBoolean,
  parseAbsoluteUrl,
  parseCorsOrigins,
  MissingEnvException,
  InvalidEnvException,
};
export type { AppConfig, DatabaseConfig };
export const configurationLoaders = [appConfig, databaseConfig];
