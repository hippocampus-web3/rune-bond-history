import { DataSource } from 'typeorm';
import { AppDataSource } from './database';
import { join } from 'path';

export const migrationDataSource = new DataSource({
    ...AppDataSource.options,
    migrations: [join(__dirname, "migrations/*.{ts,js}")],
    migrationsTableName: 'migrations',
}); 