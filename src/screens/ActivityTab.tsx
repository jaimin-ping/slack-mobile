import WorkspaceHeader from '../WorkspaceHeader';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Message } from '../api';
import { RootStack } from '../navigation';
import { Avatar, useTheme } from '../ui';
import { ThemeColors } from '../theme';

interface ActivityItem {
  id: number;
  type: 'mention' | 'reaction' | 'thread' | 'dm';
  message: Message;
  channel_id: number;
  channel_name: string;
}

export default function ActivityTab({ slug }: { slug: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const load = useCallback(async () => {
    try {
      const data = await api<{ activities: ActivityItem[] }>(`/w/${slug}/activity`);
      setActivities(data.activities || []);
    } catch {
      // Show empty state
      setActivities([]);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <WorkspaceHeader style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Activity</Text>
        <View style={styles.tabs}>
          <Text style={[styles.tab, styles.tabActive]}>All</Text>
          <Text style={styles.tab}>Mentions</Text>
          <Text style={styles.tab}>Threads</Text>
        </View>
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
        {activities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={44} color={colors.muted} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>You're all caught up!</Text>
            <Text style={styles.emptyText}>
              When someone mentions you or replies to your messages, you'll see it here.
            </Text>
          </View>
        ) : (
          activities.map((activity) => (
            <Pressable
              key={activity.id}
              style={styles.activityRow}
              onPress={() => navigation.navigate('Chat', {
                slug,
                channelId: activity.channel_id,
                title: activity.channel_name,
                parentId: activity.message.parent_id ?? undefined,
              })}
            >
              <Avatar user={activity.message.user} size={40} />
              <View style={styles.activityContent}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityUser}>{activity.message.user.name}</Text>
                  <Text style={styles.activityChannel}>in #{activity.channel_name}</Text>
                  <Text style={styles.activityTime}>{formatTime(activity.message.created_at)}</Text>
                </View>
                <Text style={styles.activityBody} numberOfLines={2}>
                  {activity.message.body}
                </Text>
              </View>
            </Pressable>
          ))
        )}

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
      
      paddingBottom: 12,
    },
    title: {
      color: colors.textBright,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 12,
    },
    tabs: {
      flexDirection: 'row',
      gap: 20,
    },
    tab: {
      color: colors.muted,
      fontSize: 15,
      fontWeight: '600',
    },
    tabActive: {
      color: colors.textBright,
    },
    content: {
      flex: 1,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
    activityRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    activityContent: {
      flex: 1,
    },
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    activityUser: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
    activityChannel: {
      color: colors.muted,
      fontSize: 13,
    },
    activityTime: {
      color: colors.muted,
      fontSize: 12,
      marginLeft: 'auto',
    },
    activityBody: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
    },
  });
