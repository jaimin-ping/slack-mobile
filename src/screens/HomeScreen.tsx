import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, Channel, getSession, Message, User, Workspace } from '../api';
import { RootStack } from '../navigation';
import { listen } from '../realtime';
import { Avatar, colors } from '../ui';
import { Extras, setWorkspaceData } from '../workspaceData';

interface Bootstrap {
  workspace: Workspace;
  channels: Channel[];
  members: User[];
  extras: Extras;
}

export default function HomeScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Home'>) {
  const { slug } = route.params;
  const me = getSession()?.user;
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const stops = useRef(new Map<number, () => void>());

  const load = useCallback(async () => {
    try {
      const next = await api<Bootstrap>(`/w/${slug}`);
      setWorkspaceData(next.members, next.extras);
      setData(next);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: data?.workspace.name ?? 'Ping Chat',
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Search', { slug })}>
            <Text style={styles.headerLink}>Search</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Activity', { slug })}>
            <Text style={styles.headerLink}>Activity</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, data?.workspace.name, slug]);

  // Unread numbers rise live for every conversation.
  useEffect(() => {
    data?.channels.forEach(({ id }) => {
      if (stops.current.has(id)) return;

      stops.current.set(
        id,
        listen<Message>(`private-channel.${id}`, 'message.sent', (message) => {
          if (message.parent_id !== null || message.user.id === me?.id) return;

          setData((current) =>
            current && {
              ...current,
              channels: current.channels.map((c) => (c.id === id ? { ...c, unread: c.unread + 1 } : c)),
            },
          );
        }),
      );
    });
  }, [data?.channels, me?.id]);

  useEffect(() => {
    const all = stops.current;

    return () => {
      all.forEach((stop) => stop());
      all.clear();
    };
  }, []);

  const open = (channel: Channel, title: string) =>
    navigation.navigate('Chat', { slug, channelId: channel.id, title });

  const openPerson = async (person: User) => {
    const existing = data?.channels.find((c) => c.dm_user_id === person.id);

    if (existing) {
      open(existing, person.name);
      return;
    }

    const { channel_id } = await api<{ channel_id: number }>(`/w/${slug}/dm/${person.id}`, 'POST');
    navigation.navigate('Chat', { slug, channelId: channel_id, title: person.name });
  };

  const named = data?.channels.filter((c) => c.type !== 'dm') ?? [];
  const people = data?.members.filter((m) => m.id !== me?.id) ?? [];

  const channelRow = (channel: Channel) => (
    <Pressable key={channel.id} accessibilityRole="button" onPress={() => open(channel, `#${channel.name}`)} style={styles.row}>
      <Text style={styles.icon}>{channel.type === 'private' ? '🔒' : '#'}</Text>
      <Text style={[styles.name, channel.unread > 0 && !channel.muted && styles.unreadName, channel.muted && styles.muted]}>{channel.name}</Text>
      {channel.unread > 0 && !channel.muted && <Text style={styles.badge}>{channel.unread}</Text>}
    </Pressable>
  );

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      style={styles.screen}
    >
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Threads', { slug })}>
        <Text style={styles.shortcut}>💬  Threads</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Drafts', { slug })}>
        <Text style={styles.shortcut}>✏️  Drafts</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Scheduled', { slug })}>
        <Text style={styles.shortcut}>🕒  Scheduled</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Saved', { slug })}>
        <Text style={styles.shortcut}>🔖  Saved items</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Files', { slug })}>
        <Text style={styles.shortcut}>📁  Files</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Profile')}>
        <Text style={styles.shortcut}>👤  Profile</Text>
      </Pressable>

      {data?.extras.sections.map((section) => (
        <View key={section.id}>
          <Text style={styles.section}>{section.name}</Text>
          {named.filter((c) => c.section_id === section.id).map(channelRow)}
        </View>
      ))}

      <Text style={styles.section}>Channels</Text>
      {named.filter((c) => !c.section_id).map(channelRow)}

      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('NewChannel', { slug })}>
        <Text style={styles.shortcut}>＋  Add channel</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Browse', { slug })}>
        <Text style={styles.shortcut}>🔍  Browse channels</Text>
      </Pressable>

      <Text style={styles.section}>Direct messages</Text>
      {people.map((person) => {
        const dm = data?.channels.find((c) => c.dm_user_id === person.id);

        return (
          <Pressable key={person.id} accessibilityRole="button" onPress={() => openPerson(person)} style={styles.row}>
            <Avatar user={person} size={26} />
            <Text style={[styles.name, !!dm?.unread && styles.unreadName]}>{person.name}</Text>
            {person.status_emoji && <Text>{person.status_emoji}</Text>}
            {!!dm?.unread && <Text style={styles.badge}>{dm.unread}</Text>}
          </Pressable>
        );
      })}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark, flex: 1 },
  headerActions: { flexDirection: 'row', gap: 14 },
  headerLink: { color: '#fff', fontSize: 15 },
  section: { color: '#99f6e4', fontSize: 13, fontWeight: '700', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  icon: { color: '#ccfbf1', fontSize: 15, textAlign: 'center', width: 26 },
  name: { color: '#ccfbf1', flex: 1, fontSize: 16 },
  unreadName: { color: '#fff', fontWeight: '700' },
  muted: { opacity: 0.5 },
  badge: { backgroundColor: colors.accent, borderRadius: 10, color: '#0f172a', fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 1 },
  error: { color: '#fecdd3', padding: 16 },
  shortcut: { color: '#ccfbf1', fontSize: 15, paddingHorizontal: 16, paddingVertical: 9 },
});
