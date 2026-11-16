import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, Message, Workspace } from '../api';
import { RootStack } from '../navigation';
import { colors, time } from '../ui';

function Row({ label, title, body, onPress }: { label: string; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.title}>{title}</Text>
      {!!body && <Text numberOfLines={2} style={styles.body}>{body}</Text>}
    </Pressable>
  );
}

export function WorkspacesScreen({
  navigation,
  onSignOut,
}: NativeStackScreenProps<RootStack, 'Workspaces'> & { onSignOut: () => void }) {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Workspace[]>('/workspaces')
      .then((data) => {
        setWorkspaces(data);
        if (data.length === 1) navigation.replace('Home', { slug: data[0].slug });
      })
      .catch((e) => setError(e.message));
  }, [navigation]);

  return (
    <View style={styles.screen}>
      {error && <Text style={styles.error}>{error}</Text>}
      {workspaces?.length === 0 && (
        <Text style={styles.empty}>Join a workspace on the website first, then come back here.</Text>
      )}
      <FlatList
        data={workspaces ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Home', { slug: item.slug })} style={styles.row}>
            <Text style={styles.title}>{item.name}</Text>
          </Pressable>
        )}
      />
      <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

interface ActivityItem {
  id: number;
  type: 'mention' | 'reply';
  message: Message;
  channel_label: string;
}

export function ActivityScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Activity'>) {
  const { slug } = route.params;
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    api<ActivityItem[]>(`/w/${slug}/activity`).then(setItems).catch(() => setItems([]));
    api(`/w/${slug}/activity/read`, 'POST').catch(() => {});
  }, [slug]);

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={items ? <Text style={styles.empty}>Mentions and thread replies show up here.</Text> : undefined}
      renderItem={({ item }) => (
        <Row
          label={`${item.type === 'mention' ? 'Mention' : 'Thread reply'} in ${item.channel_label} · ${time(item.message.created_at)}`}
          title={item.message.user.name}
          body={item.message.body}
          onPress={() =>
            navigation.navigate('Chat', {
              slug,
              channelId: item.message.channel_id,
              title: item.channel_label,
              parentId: item.message.parent_id ?? undefined,
            })
          }
        />
      )}
      style={styles.screen}
    />
  );
}

export function SearchScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Search'>) {
  const { slug } = route.params;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Message & { channel_label: string })[] | null>(null);

  useEffect(() => {
    const term = query.trim();

    if (term.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(() => {
      api<(Message & { channel_label: string })[]>(`/w/${slug}/search?q=${encodeURIComponent(term)}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);

    return () => clearTimeout(timer);
  }, [query, slug]);

  return (
    <View style={styles.screen}>
      <TextInput
        accessibilityLabel="Search messages"
        autoCapitalize="none"
        autoFocus
        onChangeText={setQuery}
        placeholder="Search messages"
        style={styles.search}
        value={query}
      />
      <FlatList
        data={results ?? []}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={results ? <Text style={styles.empty}>No messages found.</Text> : undefined}
        renderItem={({ item }) => (
          <Row
            label={item.channel_label}
            title={item.user.name}
            body={item.body}
            onPress={() =>
              navigation.navigate('Chat', {
                slug,
                channelId: item.channel_id,
                title: item.channel_label,
                parentId: item.parent_id ?? undefined,
              })
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#fff', flex: 1 },
  row: { borderBottomColor: colors.line, borderBottomWidth: 1, padding: 14 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 2 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.text, fontSize: 14, marginTop: 2 },
  empty: { color: colors.muted, padding: 24, textAlign: 'center' },
  error: { color: colors.danger, padding: 14 },
  search: { backgroundColor: colors.soft, borderRadius: 10, color: colors.text, fontSize: 16, margin: 12, padding: 10 },
  signOut: { alignItems: 'center', padding: 16 },
  signOutText: { color: colors.danger, fontSize: 16 },
});
