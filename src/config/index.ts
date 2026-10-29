import appConfig, { getAppConfig, AppConfig } from './app.config';
import databaseConfig, {
  getDatabaseConfig,
  DatabaseConfig,
} from './database.config';
import {
  getRequiredEnv,
  getRequiredEnvNumber,
  MissingEnvException,
  InvalidEnvException,
} from './env.validator';

export {
  appConfig,
  getAppConfig,
  databaseConfig,
  getDatabaseConfig,
  getRequiredEnv,
  getRequiredEnvNumber,
  MissingEnvException,
  InvalidEnvException,
};
export type { AppConfig, DatabaseConfig };
export const configurationLoaders = [appConfig, databaseConfig];
