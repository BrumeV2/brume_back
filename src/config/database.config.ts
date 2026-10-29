import { registerAs } from '@nestjs/config';
import { getRequiredEnv, getRequiredEnvNumber } from './env.validator';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

export const getDatabaseConfig = (): DatabaseConfig => ({
  host: getRequiredEnv('DB_HOST'),
  port: getRequiredEnvNumber('DB_PORT'),
  user: getRequiredEnv('DB_USER'),
  password: getRequiredEnv('DB_PASSWORD'),
  name: getRequiredEnv('DB_NAME'),
});

export default registerAs('database', getDatabaseConfig);
