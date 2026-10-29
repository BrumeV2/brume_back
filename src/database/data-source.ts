import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'node:path';
import { getDatabaseConfig } from '../config/database.config';

const db = getDatabaseConfig();

export default new DataSource({
  type: 'postgres',
  host: db.host,
  port: db.port,
  username: db.user,
  password: db.password,
  database: db.name,
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
});
