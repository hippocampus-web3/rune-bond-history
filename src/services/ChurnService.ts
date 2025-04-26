import { fetchWithRetries } from '../utils/fetchWithRetries';
import { logger } from '../utils/logger';

interface MidgardChurn {
    height: string;
    date: string;
}

export class ChurnService {
    private readonly baseUrl = 'https://midgard.ninerealms.com/v2';

    async getChurns(): Promise<MidgardChurn[]> {
        logger.debug('Fetching churns from Midgard...');
        const url = `${this.baseUrl}/churns`;
        const churns = await fetchWithRetries<MidgardChurn[]>(url);
        logger.debug(`Found ${churns.length} churns`);
        return churns;
    }

    async getLatestChurn(): Promise<MidgardChurn | null> {
        logger.debug('Fetching latest churn...');
        const churns = await this.getChurns();
        const latestChurn = churns.length > 0 ? churns[0] : null;
        
        if (latestChurn) {
            logger.debug(`Latest churn found at height ${latestChurn.height}`);
        } else {
            logger.debug('No churns found');
        }
        
        return latestChurn;
    }
} 