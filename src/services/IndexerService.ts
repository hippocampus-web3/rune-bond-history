import { AppDataSource } from '../config/database';
import { Snapshot } from '../entities/Snapshot';
import { Node } from '../entities/Node';
import { BondProvider } from '../entities/BondProvider';
import { ChurnService } from './ChurnService';
import { NodeService } from './NodeService';
import { NotificationService } from './NotificationService';
import { nanoToDate } from '../utils/timeUtils';
import { logger } from '../utils/logger';
import { LessThan } from 'typeorm';
import { baseToAsset, baseAmount } from '@xchainjs/xchain-util';

export class IndexerService {
    private churnService: ChurnService;
    private nodeService: NodeService;
    private notificationService: NotificationService;

    constructor() {
        this.churnService = new ChurnService();
        this.nodeService = new NodeService();
        this.notificationService = NotificationService.getInstance();
    }

    private async getPreviousNodeStatus(nodeAddress: string, currentBlockNumber: number): Promise<string | null> {
        const nodeRepository = AppDataSource.getRepository(Node);
        const previousNode = await nodeRepository.findOne({
            where: { 
                node_address: nodeAddress,
                block_number: LessThan(currentBlockNumber)
            },
            order: { block_number: 'DESC' },
            select: ['status', 'block_number']
        });

        if (!previousNode) {
            return null;
        }

        return previousNode.status;
    }

    private async getPreviousBondBalance(nodeAddress: string, bondProviderAddress: string, currentBlockNumber: number): Promise<number | null> {
        const bondProviderRepository = AppDataSource.getRepository(BondProvider);
        const previousBond = await bondProviderRepository.findOne({
            where: { 
                node_address: nodeAddress,
                bond_provider_address: bondProviderAddress,
                block_number: LessThan(currentBlockNumber)
            },
            order: { block_number: 'DESC' },
            select: ['bond_amount']
        });

        return previousBond?.bond_amount ?? null;
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

        const indexingBlockEarnings = blockNumber - 100; // For earnings it's importart use a block prior to the churn but for status it's not
        logger.info(`Using block ${indexingBlockEarnings} for indexing (original churn block: ${blockNumber})`);

        logger.info(`Fetching nodes for block ${indexingBlockEarnings} for earnings...`);
        const nodes = await this.nodeService.getNodes(indexingBlockEarnings);
        logger.info(`Found ${nodes.length} nodes`);

        const nodesAfterChurn = await this.nodeService.getNodes(blockNumber + 100);
        logger.info(`Found ${nodesAfterChurn.length} nodes`);

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

                const nodeAfterChurn = nodesAfterChurn.find(n => n.node_address === nodeData.node_address);

                if (!nodeAfterChurn) {
                    logger.error(`Node ${nodeData.node_address} not found after churn`);
                    continue;
                }

                const node = new Node();
                node.block_number = blockNumber;
                node.node_address = nodeAfterChurn.node_address;
                node.total_bond = Number(nodeAfterChurn.total_bond);
                node.earnings = Number(nodeData.current_award);
                node.status = nodeAfterChurn.status; // Important get the status from the node after the churn
                node.snapshot = savedSnapshot;
                const previousStatus = await this.getPreviousNodeStatus(nodeAfterChurn.node_address, blockNumber);
                const savedNode = await queryRunner.manager.save(node);
                logger.debug(`Node saved with ID: ${savedNode.id}`);

                if (nodeAfterChurn.bond_providers?.providers?.length) {
                    logger.debug(`Processing ${nodeAfterChurn.bond_providers.providers.length} bond providers for node ${nodeAfterChurn.node_address}`);
                    
                    for (const provider of nodeAfterChurn.bond_providers.providers) {
                        const bondProvider = new BondProvider();
                        bondProvider.block_number = blockNumber;
                        bondProvider.node_address = nodeAfterChurn.node_address;
                        bondProvider.bond_provider_address = provider.bond_address;
                        bondProvider.bond_amount = Number(provider.bond);
                        bondProvider.node = savedNode;

                        const previousBondBalance = await this.getPreviousBondBalance(
                            nodeAfterChurn.node_address,
                            provider.bond_address,
                            blockNumber
                        );

                        await queryRunner.manager.save(bondProvider);

                        const bondAmount = Number(provider.bond);
                        
                        if (previousStatus !== null && 
                            previousStatus !== nodeAfterChurn.status &&
                            !((previousStatus === 'Active' && nodeAfterChurn.status === 'Ready') ||
                              (previousStatus === 'Ready' && nodeAfterChurn.status === 'Active'))) {
                            
                            if (bondAmount > 0) {
                                logger.debug(`Sending status change notification to bond provider ${provider.bond_address} with ${bondAmount} RUNE bonded`);
                                await this.notificationService.emitNodeStatusChanged(
                                    provider.bond_address,
                                    nodeAfterChurn.node_address,
                                    nodeAfterChurn.status,
                                    `Status changed from ${previousStatus} to ${nodeAfterChurn.status} at block ${blockNumber}. Remember that nodes in standby mode do not generate rewards, but this is when UNBOND becomes possible.`
                                );
                            }
                        }

                        if (nodeAfterChurn.status === 'Active' && previousBondBalance !== null) {
                            const prevBondBalanceAssetAmount = baseToAsset(baseAmount(previousBondBalance.toString())).amount().toFixed(3);
                            const newBondBalanceAssetAmount = baseToAsset(baseAmount(provider.bond)).amount().toFixed(3);
                            if (prevBondBalanceAssetAmount !== newBondBalanceAssetAmount) {
                                logger.debug(`Sending bond balance change notification to provider ${provider.bond_address}`);
                                await this.notificationService.emitNodeChurn(
                                    provider.bond_address,
                                    nodeAfterChurn.node_address,
                                    prevBondBalanceAssetAmount,
                                    newBondBalanceAssetAmount,
                                    'RUNE',
                                );
                            }
                        }
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

        const sortedChurns = churns.sort((a, b) => parseInt(a.height) - parseInt(b.height));

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