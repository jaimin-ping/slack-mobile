export type RootStack = {
  Workspaces: undefined;
  Home: { slug: string };
  Chat: { slug: string; channelId: number; title: string; parentId?: number };
  Activity: { slug: string };
  Search: { slug: string };
  Browse: { slug: string };
  NewChannel: { slug: string };
  Saved: { slug: string };
  Drafts: { slug: string };
  Scheduled: { slug: string };
  Threads: { slug: string };
  Files: { slug: string };
  Profile: undefined;
  ChannelInfo: { slug: string; channelId: number; title: string };
  Huddle: { slug: string; channelId: number; title: string };
  Canvas: { slug: string; channelId: number; title: string };
  Forward: { slug: string; channelId: number; messageId: number };
};
