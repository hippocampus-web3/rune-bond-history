export type NotificationType = 'node_status_changed' | 'node_churn';

export type BaseNotificationPayload = {
  nodeName: string;
  nodeDashboardUrl: string;
};

export type NodeStatusPayload = BaseNotificationPayload & {
  status: string;
  details?: string;
};

export type NodeChurnPayload = BaseNotificationPayload & {
  previousBondBalance: string;
  newBondBalance: string;
  tokenSymbol: string;
  details?: string;
};

export type NotificationPayload = {
  node_status_changed: NodeStatusPayload;
  node_churn: NodeChurnPayload;
};

export type NotificationJob = {
  observableAddress: string;
  type: NotificationType;
  payload: NotificationPayload[NotificationType];
}; 