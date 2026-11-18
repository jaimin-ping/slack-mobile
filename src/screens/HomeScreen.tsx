import Ionicons, { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, Channel, getSession, Message, User, Workspace } from '../api';
import { RootStack } from '../navigation';
import { listen } from '../realtime';
import { Avatar, useTheme } from '../ui';
import { ThemeColors } from '../theme';
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
  const { colors } = useTheme();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const stops = useRef(new Map<number, () => void>());

  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  }, [navigation, data?.workspace.name, slug, styles]);

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

  const open = (channel: Channel, title: string, dmUser?: User) =>
    navigation.navigate('Chat', {
      slug,
      channelId: channel.id,
      title,
      channelType: channel.type,
      dmUser: dmUser ? {
        id: dmUser.id,
        name: dmUser.name,
        avatar_url: dmUser.avatar_url,
        status_emoji: dmUser.status_emoji,
      } : undefined,
    });

  const openPerson = async (person: User) => {
    const existing = data?.channels.find((c) => c.dm_user_id === person.id);

    if (existing) {
      open(existing, person.name, person);
      return;
    }

    const { channel_id } = await api<{ channel_id: number }>(`/w/${slug}/dm/${person.id}`, 'POST');
    navigation.navigate('Chat', {
      slug,
      channelId: channel_id,
      title: person.name,
      channelType: 'dm',
      dmUser: {
        id: person.id,
        name: person.name,
        avatar_url: person.avatar_url,
        status_emoji: person.status_emoji,
      },
    });
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
        <View style={styles.shortcutRow}>
          <Ionicons name="chatbubbles-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.shortcut}>Threads</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Drafts', { slug })}>
        <View style={styles.shortcutRow}>
          <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.shortcut}>Drafts</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Scheduled', { slug })}>
        <View style={styles.shortcutRow}>
          <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.shortcut}>Scheduled</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Saved', { slug })}>
        <View style={styles.shortcutRow}>
          <Ionicons name="bookmark-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.shortcut}>Saved items</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Files', { slug })}>
        <View style={styles.shortcutRow}>
          <Ionicons name="folder-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.shortcut}>Files</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Profile')}>
        <View style={styles.shortcutRow}>
          <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.shortcut}>Profile</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Preferences')}>
        <View style={styles.shortcutRow}>
          <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.shortcut}>Preferences</Text>
        </View>
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
        <View style={styles.shortcutRow}>
          <Ionicons name="add" size={18} color={colors.textSecondary} />
          <Text style={styles.shortcut}>Add channel</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Browse', { slug })}>
        <View style={styles.shortcutRow}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.shortcut}>Browse channels</Text>
        </View>
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { backgroundColor: colors.dark, flex: 1 },
  headerActions: { flexDirection: 'row', gap: 14 },
  headerLink: { color: colors.textBright, fontSize: 15 },
  section: { color: colors.accent, fontSize: 13, fontWeight: '700', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  icon: { color: colors.text, fontSize: 15, textAlign: 'center', width: 26 },
  name: { color: colors.text, flex: 1, fontSize: 16 },
  unreadName: { color: colors.textBright, fontWeight: '700' },
  muted: { opacity: 0.5 },
  badge: { backgroundColor: colors.danger, borderRadius: 10, color: colors.textBright, fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 1 },
  error: { color: colors.danger, padding: 16 },
  shortcutRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  shortcut: { color: colors.text, fontSize: 15 },
});
