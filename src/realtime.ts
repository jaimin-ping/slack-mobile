import { api, getSession } from './api';
import Pusher from './pusherClient';

interface RealtimeConfig {
  key: string;
  port: number;
  scheme: string;
}

let client: Pusher | null = null;

export async function connect(): Promise<Pusher | null> {
  const session = getSession();
  if (client || !session) return client;

  const config = await api<RealtimeConfig>('/config');
  const host = new URL(session.server).hostname;

  client = new Pusher(config.key, {
    wsHost: host,
    wsPort: config.port,
    wssPort: config.port,
    forceTLS: config.scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    cluster: '',
    channelAuthorization: {
      endpoint: '',
      transport: 'ajax',
      customHandler: ({ socketId, channelName }, callback) => {
        api<{ auth: string }>('/broadcasting/auth', 'POST', { socket_id: socketId, channel_name: channelName })
          .then((data) => callback(null, data))
          .catch((error) => callback(error, null));
      },
    },
  });

  return client;
}

export function joinPresence(channelName: string) {
  return client ? client.subscribe(channelName) : null;
}

export function leavePresence(channelName: string) {
  client?.unsubscribe(channelName);
}

export function disconnect() {
  client?.disconnect();
  client = null;
}

/** Listens to one event on a channel and returns a function that stops listening. */
export function listen<T>(channelName: string, event: string, handler: (data: T) => void): () => void {
  if (!client) return () => {};

  const channel = client.channel(channelName) ?? client.subscribe(channelName);
  channel.bind(event, handler);

  return () => channel.unbind(event, handler);
}
