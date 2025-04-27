import { fetchWithRetries } from '../utils/fetchWithRetries';
import { logger } from '../utils/logger';

interface ThornodeNode {
    node_address: string;
    status: string;
    total_bond: string;
    current_award: string;
    bond_providers?: {
        providers?: Array<{
            bond_address: string;
            bond: string;
        }>;
    };
}

export class NodeService {
    private readonly baseUrl = process.env.THORNODE_URL;

    async getNodes(blockNumber: number): Promise<ThornodeNode[]> {
        logger.debug(`Fetching nodes for block ${blockNumber}...`);
        const url = `${this.baseUrl}/nodes?height=${blockNumber}`;
        const nodes = await fetchWithRetries<ThornodeNode[]>(url);
        logger.debug(`Found ${nodes.length} nodes`);
        return nodes;
    }

    calculateTotalActiveBond(nodes: ThornodeNode[]): number {
        logger.debug('Calculating total active bond...');
        const activeNodes = nodes.filter(node => node.status === 'Active');
        const totalBond = activeNodes.reduce((sum, node) => sum + Number(node.total_bond), 0);
        logger.debug(`Total active bond: ${totalBond} (from ${activeNodes.length} active nodes)`);
        return totalBond;
    }
} 