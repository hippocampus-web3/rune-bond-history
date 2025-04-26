import { migrationDataSource } from '../config/migration.config';

async function generateMigration(name: string) {
    try {
        await migrationDataSource.initialize();
        console.log('Generating migration...');
        await migrationDataSource.createQueryRunner().createSchema('public', true);
        await migrationDataSource.runMigrations();
        await migrationDataSource.destroy();

        const timestamp = new Date().getTime();
        const migrationName = `${timestamp}-${name}`;
        
        console.log(`Migration ${migrationName} generated successfully`);
    } catch (error) {
        console.error('Error generating migration:', error);
        process.exit(1);
    }
}

const migrationName = process.argv[2];
if (!migrationName) {
    console.error('Please provide a migration name');
    process.exit(1);
}

generateMigration(migrationName); 