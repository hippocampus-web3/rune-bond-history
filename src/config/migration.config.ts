import { DataSource } from 'typeorm';
import { AppDataSource } from './database';

export const migrationDataSource = new DataSource({
    ...AppDataSource.options,
    migrations: ['src/migrations/*.ts'],
    migrationsTableName: 'migrations',
}); 