import WorkspaceHeader from '../WorkspaceHeader';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Message } from '../api';
import { RootStack } from '../navigation';
import { Avatar, useTheme } from '../ui';
import { ThemeColors } from '../theme';

interface SearchResult {
  id: number;
  message: Message;
  channel_id: number;
  channel_name: string;
}

export default function SearchTab({ slug }: { slug: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentSearches] = useState(['project updates', 'meeting notes', '@john']);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const search = async () => {
    if (!query.trim()) return;

    setSearching(true);
    try {
      const data = await api<{ results: SearchResult[] }>(`/w/${slug}/search?q=${encodeURIComponent(query)}`);
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <WorkspaceHeader style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Search</Text>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={17} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages, files, and more"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </Pressable>
          )}
        </View>
      </WorkspaceHeader>

      <ScrollView style={styles.content}>
        {query.length === 0 ? (
          <>
            {/* Recent Searches */}
            <Text style={styles.sectionTitle}>Recent searches</Text>
            {recentSearches.map((item, index) => (
              <Pressable
                key={index}
                style={styles.recentRow}
                onPress={() => setQuery(item)}
              >
                <Text style={styles.recentIcon}>🕐</Text>
                <Text style={styles.recentText}>{item}</Text>
              </Pressable>
            ))}

            {/* Quick Filters */}
            <Text style={styles.sectionTitle}>Browse</Text>
            <Pressable style={styles.browseRow} onPress={() => navigation.navigate('Files', { slug })}>
              <Ionicons name="folder-outline" size={22} color={colors.textSecondary} style={styles.browseIcon} />
              <Text style={styles.browseText}>Files</Text>
            </Pressable>
            <Pressable style={styles.browseRow} onPress={() => navigation.navigate('Browse', { slug })}>
              <Text style={styles.browseIcon}>#</Text>
              <Text style={styles.browseText}>Channels</Text>
            </Pressable>
            <Pressable style={styles.browseRow}>
              <Ionicons name="people-outline" size={22} color={colors.textSecondary} style={styles.browseIcon} />
              <Text style={styles.browseText}>People</Text>
            </Pressable>
          </>
        ) : results.length === 0 && !searching ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={44} color={colors.muted} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptyText}>
              Try different keywords or check your spelling
            </Text>
          </View>
        ) : (
          results.map((result) => (
            <Pressable
              key={result.id}
              style={styles.resultRow}
              onPress={() => navigation.navigate('Chat', {
                slug,
                channelId: result.channel_id,
                title: result.channel_name,
              })}
            >
              <Avatar user={result.message.user} size={36} />
              <View style={styles.resultContent}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultUser}>{result.message.user.name}</Text>
                  <Text style={styles.resultChannel}>#{result.channel_name}</Text>
                  <Text style={styles.resultTime}>{formatTime(result.message.created_at)}</Text>
                </View>
                <Text style={styles.resultBody} numberOfLines={2}>
                  {result.message.body}
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
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderRadius: 10,
      paddingHorizontal: 14,
      gap: 10,
    },
    searchIcon: {
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 12,
    },
    clearBtn: {
      color: colors.muted,
      fontSize: 16,
      padding: 4,
    },
    content: {
      flex: 1,
    },
    sectionTitle: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginTop: 20,
      marginBottom: 8,
      marginHorizontal: 16,
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    recentIcon: {
      fontSize: 16,
    },
    recentText: {
      color: colors.text,
      fontSize: 16,
    },
    browseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    browseIcon: {
      fontSize: 20,
      width: 28,
      textAlign: 'center',
    },
    browseText: {
      color: colors.text,
      fontSize: 16,
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
    },
    resultRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    resultContent: {
      flex: 1,
    },
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    resultUser: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 14,
    },
    resultChannel: {
      color: colors.muted,
      fontSize: 13,
    },
    resultTime: {
      color: colors.muted,
      fontSize: 12,
      marginLeft: 'auto',
    },
    resultBody: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
  });
