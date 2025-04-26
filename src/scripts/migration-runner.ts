import { migrationDataSource } from '../config/migration.config';

async function runMigrations() {
    try {
        await migrationDataSource.initialize();
        console.log('Running migrations...');
        await migrationDataSource.runMigrations();
        console.log('Migrations completed successfully');
    } catch (error) {
        console.error('Error during migrations:', error);
        process.exit(1);
    } finally {
        await migrationDataSource.destroy();
    }
}

runMigrations(); 