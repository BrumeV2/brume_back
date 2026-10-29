import { registerAs } from '@nestjs/config';
import { getRequiredEnv, getRequiredEnvNumber } from './env.validator';

export interface AppConfig {
  port: number;
  corsOrigin: string[];
}

export const getAppConfig = (): AppConfig => ({
  port: getRequiredEnvNumber('PORT'),
  corsOrigin: getRequiredEnv('CORS_ORIGIN')
    .split(',')
    .map((origin) => origin.trim()),
});

export default registerAs('app', getAppConfig);
