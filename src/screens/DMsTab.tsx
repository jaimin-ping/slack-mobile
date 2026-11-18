import WorkspaceHeader from '../WorkspaceHeader';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Channel, getSession, User } from '../api';
import { RootStack } from '../navigation';
import { Avatar, useTheme } from '../ui';
import { ThemeColors } from '../theme';

interface DMData {
  channels: Channel[];
  members: User[];
}

export default function DMsTab({ slug }: { slug: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const me = getSession()?.user;

  const [data, setData] = useState<DMData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const load = useCallback(async () => {
    try {
      const result = await api<{ channels: Channel[]; members: User[] }>(`/w/${slug}`);
      setData({
        channels: result.channels.filter((c) => c.type === 'dm'),
        members: result.members,
      });
    } catch {
      // Ignore
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const openDM = async (person: User) => {
    const dmUser = {
      id: person.id,
      name: person.name,
      avatar_url: person.avatar_url,
      status_emoji: person.status_emoji,
    };
    const existing = data?.channels.find((c) => c.dm_user_id === person.id);
    if (existing) {
      navigation.navigate('Chat', { slug, channelId: existing.id, title: person.name, channelType: 'dm', dmUser });
      return;
    }
    const { channel_id } = await api<{ channel_id: number }>(`/w/${slug}/dm/${person.id}`, 'POST');
    navigation.navigate('Chat', { slug, channelId: channel_id, title: person.name, channelType: 'dm', dmUser });
  };

  // Include current user for self-DM, put them first
  const otherPeople = data?.members.filter((m) => m.id !== me?.id) ?? [];
  const selfUser = data?.members.find((m) => m.id === me?.id);
  const people = selfUser ? [selfUser, ...otherPeople] : otherPeople;

  return (
    <View style={styles.container}>
      <WorkspaceHeader style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Direct Messages</Text>
      </WorkspaceHeader>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }} tintColor={colors.text} />
        }
      >
        {/* Search Bar */}
        <Pressable style={styles.searchBar}>
          <Ionicons name="search" size={17} color={colors.muted} style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder}>Search DMs</Text>
        </Pressable>

        {/* DM List */}
        {people.map((person) => {
          const dm = data?.channels.find((c) => c.dm_user_id === person.id);
          const isSelf = person.id === me?.id;
          return (
            <Pressable
              key={person.id}
              style={styles.dmRow}
              onPress={() => openDM(person)}
            >
              <View style={styles.avatarContainer}>
                <Avatar user={person} size={44} />
                <View style={[styles.statusDot, { backgroundColor: person.is_away ? colors.warning : colors.online }]} />
              </View>
              <View style={styles.dmInfo}>
                <Text style={[styles.dmName, !!dm?.unread && styles.unread]}>
                  {person.name}{isSelf ? ' (you)' : ''}
                </Text>
                {person.status_text && (
                  <Text style={styles.dmStatus} numberOfLines={1}>
                    {person.status_emoji} {person.status_text}
                  </Text>
                )}
              </View>
              {!!dm?.unread && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{dm.unread}</Text>
                </View>
              )}
            </Pressable>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.dark,
    },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    title: {
      color: colors.textBright,
      fontSize: 20,
      fontWeight: '700',
    },
    content: {
      flex: 1,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      marginHorizontal: 16,
      marginVertical: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      gap: 10,
    },
    searchIcon: {
    },
    searchPlaceholder: {
      color: colors.muted,
      fontSize: 16,
    },
    dmRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    avatarContainer: {
      position: 'relative',
    },
    statusDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.dark,
    },
    dmInfo: {
      flex: 1,
    },
    dmName: {
      color: colors.text,
      fontSize: 16,
    },
    unread: {
      color: colors.text,
      fontWeight: '700',
    },
    dmStatus: {
      color: colors.muted,
      fontSize: 14,
      marginTop: 2,
    },
    badge: {
      backgroundColor: colors.danger,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
  });
