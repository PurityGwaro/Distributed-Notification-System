export enum NotificationType {
  EMAIL = 'email',
  PUSH = 'push',
}

export enum NotificationStatus {
  DELIVERED = 'delivered',
  PENDING = 'pending',
  FAILED = 'failed',
}

export interface UserData {
  name: string;
  link: string;
  meta?: Record<string, any>;
}

export interface NotificationPayload {
  notification_type: NotificationType;
  user_id: string;
  template_code: string;
  variables: UserData;
  request_id: string;
  priority: number;
  metadata?: Record<string, any>;
}

export interface NotificationStatusUpdate {
  notification_id: string;
  status: NotificationStatus;
  timestamp?: Date;
  error?: string;
}
