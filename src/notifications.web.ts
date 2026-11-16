export interface NotificationTarget {
  slug: string;
  channel_id: number;
  thread: number | null;
}

// Phone notifications do not apply to the web build.
export async function registerForNotifications(): Promise<void> {}

export function onNotificationOpened(_open: (target: NotificationTarget) => void): () => void {
  return () => {};
}
