import { Queue } from 'bullmq';
import { config } from 'dotenv';
import { NotificationJob } from '../types/NotificationJob';

config();

export const notificationQueue = new Queue<NotificationJob>('notifications', {
  connection: {
    family: 0,
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false,
  },
}); 