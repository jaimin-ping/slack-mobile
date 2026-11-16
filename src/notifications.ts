import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Needs a real phone, a development or store build, and an EAS project id in app.json.
 * Without those it does nothing, and the rest of the app works as usual.
 */
export async function registerForNotifications(): Promise<void> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  if (!Device.isDevice || !projectId) return;

  try {
    const current = await Notifications.getPermissionsAsync();
    const { granted } = current.granted ? current : await Notifications.requestPermissionsAsync();

    if (!granted) return;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/device', 'POST', { token: data });
  } catch {
    // The app still works without phone notifications.
  }
}

export interface NotificationTarget {
  slug: string;
  channel_id: number;
  thread: number | null;
}

export function onNotificationOpened(open: (target: NotificationTarget) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as unknown as NotificationTarget;

    if (data?.slug && data.channel_id) open(data);
  });

  return () => subscription.remove();
}
