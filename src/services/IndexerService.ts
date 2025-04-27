import { AppDataSource } from '../config/database';
import { Snapshot } from '../entities/Snapshot';
import { Node } from '../entities/Node';
import { BondProvider } from '../entities/BondProvider';
import { ChurnService } from './ChurnService';
import { NodeService } from './NodeService';
import { nanoToDate } from '../utils/timeUtils';
import { logger } from '../utils/logger';

export class IndexerService {
    private churnService: ChurnService;
    private nodeService: NodeService;

    constructor() {
        this.churnService = new ChurnService();
        this.nodeService = new NodeService();
    }

    async getLastIndexedBlock(): Promise<number | null> {
        const snapshotRepository = AppDataSource.getRepository(Snapshot);
        const lastSnapshot = await snapshotRepository.find({
            order: { block_number: 'DESC' },
            take: 1,
            select: ['block_number']
        });
        return lastSnapshot[0]?.block_number ?? null;
    }

    async indexChurn(blockNumber: number, blockTime: Date): Promise<void> {
        const snapshotRepository = AppDataSource.getRepository(Snapshot);
        const existingSnapshot = await snapshotRepository.findOne({
            where: { block_number: blockNumber }
        });

        if (existingSnapshot) {
            logger.info(`Churn at block ${blockNumber} already indexed, skipping...`);
            return;
        }

        const indexingBlock = blockNumber - 100;
        logger.info(`Using block ${indexingBlock} for indexing (original churn block: ${blockNumber})`);

        logger.info(`Fetching nodes for block ${indexingBlock}...`);
        const nodes = await this.nodeService.getNodes(indexingBlock);
        logger.info(`Found ${nodes.length} nodes`);

        const totalActiveBond = this.nodeService.calculateTotalActiveBond(nodes);
        logger.info(`Total active bond: ${totalActiveBond}`);

        const totalEarnings = this.nodeService.calculateTotalActiveEarnings(nodes);
        logger.info(`Total active earnings: ${totalEarnings}`);

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            logger.info('Creating snapshot...');
            const snapshot = new Snapshot();
            snapshot.block_number = blockNumber;
            snapshot.block_timestamp = blockTime;
            snapshot.total_active_bond = totalActiveBond;
            snapshot.total_earnings = totalEarnings;

            const savedSnapshot = await queryRunner.manager.save(snapshot);
            logger.info(`Snapshot created with ID: ${savedSnapshot.id}`);

            logger.info('Processing nodes...');
            for (const nodeData of nodes) {
                logger.debug(`Processing node: ${nodeData.node_address}`);
                
                const node = new Node();
                node.block_number = blockNumber;
                node.node_address = nodeData.node_address;
                node.total_bond = Number(nodeData.total_bond);
                node.earnings = Number(nodeData.current_award);
                node.status = nodeData.status;
                node.snapshot = savedSnapshot;

                const savedNode = await queryRunner.manager.save(node);
                logger.debug(`Node saved with ID: ${savedNode.id}`);

                if (nodeData.bond_providers?.providers?.length) {
                    logger.debug(`Processing ${nodeData.bond_providers.providers.length} bond providers for node ${nodeData.node_address}`);
                    
                    for (const provider of nodeData.bond_providers.providers) {
                        const bondProvider = new BondProvider();
                        bondProvider.block_number = blockNumber;
                        bondProvider.node_address = nodeData.node_address;
                        bondProvider.bond_provider_address = provider.bond_address;
                        bondProvider.bond_amount = Number(provider.bond);
                        bondProvider.node = savedNode;

                        await queryRunner.manager.save(bondProvider);
                    }
                }
            }

            await queryRunner.commitTransaction();
            logger.info('Finished processing nodes');

            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            await queryRunner.rollbackTransaction();
            logger.error(`Error indexing block ${blockNumber}:`, { error });
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async indexLatestChurn(): Promise<void> {
        logger.info('Fetching latest churn...');
        const latestChurn = await this.churnService.getLatestChurn();
        if (!latestChurn) {
            logger.error('No churns found');
            throw new Error('No churns found');
        }

        const blockNumber = parseInt(latestChurn.height);
        const blockTime = nanoToDate(Number(latestChurn.date));
        logger.info(`Latest churn found at block ${blockNumber}`);
        
        await this.indexChurn(blockNumber, blockTime);
    }

    async backfillChurns(): Promise<void> {
        logger.info('Starting churn backfill...');
        const lastIndexedBlock = await this.getLastIndexedBlock();
        logger.info(`Last indexed block: ${lastIndexedBlock || 'none'}`);

        const churns = await this.churnService.getChurns();
        logger.info(`Found ${churns.length} churns in total`);

        const sortedChurns = churns.sort((a, b) => parseInt(b.height) - parseInt(a.height));

        let indexedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        const MIN_BLOCK_HEIGHT = 0; // 17466148 for non archive

        for (const churn of sortedChurns) {
            const blockNumber = parseInt(churn.height);
            const blockTime = nanoToDate(Number(churn.date));
            
            if (blockNumber <= MIN_BLOCK_HEIGHT) {
                logger.warn(`Skipping block ${blockNumber} as it is before the minimum block height (${MIN_BLOCK_HEIGHT}).`);
                logger.warn('To index blocks before this height, an archive node is required.');
                skippedCount++;
                continue;
            }
            
            if (lastIndexedBlock && blockNumber >= lastIndexedBlock) {
                logger.debug(`Skipping already indexed block ${blockNumber}`);
                skippedCount++;
                continue;
            }

            try {
                logger.info(`Indexing churn at block ${blockNumber}...`);
                await this.indexChurn(blockNumber, blockTime);
                indexedCount++;
            } catch (error) {
                failedCount++;
                logger.error(`Failed to index block ${blockNumber}:`, { error });
                logger.info('Continuing with next block...');
                
                await new Promise(resolve => setTimeout(resolve, 4000));
            }
        }

        logger.info(`Backfill completed. Indexed: ${indexedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
        
        if (failedCount > 0) {
            logger.warn(`Some churns failed to index. Total failed: ${failedCount}`);
        }
    }
} 