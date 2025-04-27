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

async function revertLastMigration() {
    try {
        await migrationDataSource.initialize();
        console.log('Reverting last migration...');
        await migrationDataSource.undoLastMigration();
        console.log('Migration reverted successfully');
    } catch (error) {
        console.error('Error during migration revert:', error);
        process.exit(1);
    } finally {
        await migrationDataSource.destroy();
    }
}

// Verificar si se pasó el flag --revert
const shouldRevert = process.argv.includes('--revert');

if (shouldRevert) {
    revertLastMigration();
} else {
    runMigrations();
} 