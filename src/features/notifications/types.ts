/** GET /broker/notifications item (zool-go-backend `notifications.service` feed). */
export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};
