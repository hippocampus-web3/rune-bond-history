import { notificationQueue } from '../queues/notificationQueue';
import { NotificationJob, NotificationType, NotificationPayload } from '../types/NotificationJob';
import { logger } from '../utils/logger';

export class NotificationService {
  private static instance: NotificationService;
  private readonly notificationsEnabled: boolean;

  private constructor() {
    this.notificationsEnabled = process.env.ENABLE_NOTIFICATIONS === 'true';
    logger.info(`Notifications are ${this.notificationsEnabled ? 'enabled' : 'disabled'}`);
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async emitNotification<T extends NotificationType>(
    observableAddress: string,
    type: T,
    payload: NotificationPayload[T]
  ): Promise<void> {
    if (!this.notificationsEnabled) {
      logger.debug(`Notifications are disabled, skipping notification: ${type} for address ${observableAddress}`);
      return;
    }

    try {
      const job: NotificationJob = {
        observableAddress,
        type,
        payload,
      };

      await notificationQueue.add('notification', job);
      logger.info(`Notification job added to queue: ${type} for address ${observableAddress}`);
    } catch (error) {
      logger.error(`Error emitting notification ${type} for address ${observableAddress}:`, error);
      throw error;
    }
  }

  public async emitNodeStatusChanged(
    bondProviderAddress: string,
    nodeAddress: string,
    status: string,
    details?: string
  ): Promise<void> {
    await this.emitNotification(bondProviderAddress, 'node_status_changed', {
      nodeName: nodeAddress,
      nodeDashboardUrl: `${process.env.RUNEBOND_URL || "https://runebond.com"}/nodes/${nodeAddress}`,
      status,
      details,
    });
  }

  public async emitNodeChurn(
    bondProviderAddress: string,
    nodeAddress: string,
    previousBondBalance: string,
    newBondBalance: string,
    tokenSymbol: string,
    details?: string
  ): Promise<void> {
    await this.emitNotification(bondProviderAddress, 'node_churn', {
      nodeName: nodeAddress,
      nodeDashboardUrl: `${process.env.RUNEBOND_URL || "https://runebond.com"}/user-requests?user=${bondProviderAddress}`,
      previousBondBalance,
      newBondBalance,
      tokenSymbol,
      details,
    });
  }
} 