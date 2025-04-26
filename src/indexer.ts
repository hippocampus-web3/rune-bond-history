import 'reflect-metadata';
import { AppDataSource } from './config/database';
import { IndexerService } from './services/IndexerService';
import { logger } from './utils/logger';

const CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 12 horas en milisegundos

async function runIndexer() {
    try {
        logger.info('Starting Thorchain churn indexer...');
        
        logger.info('Initializing database connection...');
        await AppDataSource.initialize();
        logger.info('Database connection established');

        const indexerService = new IndexerService();
        
        const shouldBackfill = process.argv.includes('--backfill');
        if (shouldBackfill) {
            logger.info('Running in backfill mode...');
            await indexerService.backfillChurns();
        } else {
            logger.info('Indexing latest churn...');
            await indexerService.indexLatestChurn();
        }

    } catch (error) {
        if (error instanceof Error) {
            logger.error('Error during indexing:', { 
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        } else {
            logger.error('Unknown error during indexing:', { error });
        }
        process.exit(1);
    } finally {
        logger.info('Closing database connection...');
        await AppDataSource.destroy();
        logger.info('Database connection closed');
    }
}

async function main() {
    const shouldBackfill = process.argv.includes('--backfill');
    
    if (shouldBackfill) {
        // En modo backfill, solo ejecutar una vez
        await runIndexer();
    } else {
        // En modo normal, ejecutar periódicamente
        await runIndexer();
        
        setInterval(async () => {
            logger.info('Starting periodic check for new churns...');
            await runIndexer();
        }, CHECK_INTERVAL);

        logger.info(`Indexer will run every ${CHECK_INTERVAL / (60 * 60 * 1000)} hours`);
    }
}

main(); 