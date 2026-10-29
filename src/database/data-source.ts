import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from '../config/database.config';

const isCompiled = __filename.endsWith('.js');
const db = getDatabaseConfig();

export default new DataSource({
  type: 'postgres',
  host: db.host,
  port: db.port,
  username: db.user,
  password: db.password,
  database: db.name,
  entities: [isCompiled ? 'dist/**/*.entity.js' : 'src/**/*.entity.ts'],
  migrations: [
    isCompiled
      ? 'dist/database/migrations/*.js'
      : 'src/database/migrations/*.ts',
  ],
});
