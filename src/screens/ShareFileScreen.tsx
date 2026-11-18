import Ionicons from '@react-native-vector-icons/ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Channel, User, getSession } from '../api';
import { RootStack } from '../navigation';
import { Avatar, useTheme } from '../ui';
import { ThemeColors } from '../theme';

interface ShareTarget {
  type: 'user' | 'channel';
  id: number;
  name: string;
  user?: User;
  channel?: Channel;
  selected: boolean;
}

export default function ShareFileScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStack, 'ShareFile'>) {
  const { slug, fileId, fileName } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const me = getSession()?.user;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadTargets = useCallback(async () => {
    try {
      const data = await api<{ members: User[]; channels: Channel[] }>(`/w/${slug}`);

      const userTargets: ShareTarget[] = data.members
        .filter((m) => m.id !== me?.id)
        .map((user) => ({
          type: 'user',
          id: user.id,
          name: user.name,
          user,
          selected: false,
        }));

      const channelTargets: ShareTarget[] = data.channels
        .filter((c) => c.type !== 'dm')
        .map((channel) => ({
          type: 'channel',
          id: channel.id,
          name: channel.name,
          channel,
          selected: false,
        }));

      setTargets([...userTargets, ...channelTargets]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [slug, me?.id]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const toggleTarget = (id: number, type: 'user' | 'channel') => {
    setTargets((prev) =>
      prev.map((t) =>
        t.id === id && t.type === type ? { ...t, selected: !t.selected } : t
      )
    );
  };

  const filteredTargets = targets.filter(
    (t) => t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTargets = targets.filter((t) => t.selected);

  const handleShare = async () => {
    if (selectedTargets.length === 0) return;

    setSending(true);
    try {
      // Share to each selected target
      for (const target of selectedTargets) {
        if (target.type === 'channel') {
          await api(`/w/${slug}/c/${target.id}/messages`, 'POST', {
            body: `Shared a file: ${fileName}`,
            file_ids: [fileId],
          });
        } else {
          // For users, create/get DM first then share
          const { channel_id } = await api<{ channel_id: number }>(
            `/w/${slug}/dm/${target.id}`,
            'POST'
          );
          await api(`/w/${slug}/c/${channel_id}/messages`, 'POST', {
            body: `Shared a file: ${fileName}`,
            file_ids: [fileId],
          });
        }
      }

      Alert.alert('Shared', `File shared with ${selectedTargets.length} recipient(s)`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not share the file');
    } finally {
      setSending(false);
    }
  };

  const renderTarget = ({ item }: { item: ShareTarget }) => (
    <Pressable
      style={styles.targetRow}
      onPress={() => toggleTarget(item.id, item.type)}
    >
      {item.type === 'user' && item.user ? (
        <Avatar user={item.user} size={40} />
      ) : (
        <View style={styles.channelIcon}>
          <Text style={styles.channelHash}>{item.channel?.type === 'private' ? '🔒' : '#'}</Text>
        </View>
      )}

      <View style={styles.targetInfo}>
        <Text style={styles.targetName}>
          {item.type === 'channel' ? `#${item.name}` : item.name}
        </Text>
        {item.type === 'user' && (
          <Text style={styles.targetSubtitle}>{item.name}</Text>
        )}
      </View>

      {item.selected && (
        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
      )}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Share file</Text>
        <Pressable
          style={[styles.sendButton, selectedTargets.length === 0 && styles.sendButtonDisabled]}
          onPress={handleShare}
          disabled={selectedTargets.length === 0 || sending}
        >
          <Ionicons
            name="send"
            size={22}
            color={selectedTargets.length > 0 ? colors.primary : colors.muted}
          />
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Add a channel or person"
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Selected Chips */}
      {selectedTargets.length > 0 && (
        <View style={styles.chipsContainer}>
          {selectedTargets.map((t) => (
            <Pressable
              key={`${t.type}-${t.id}`}
              style={styles.chip}
              onPress={() => toggleTarget(t.id, t.type)}
            >
              <Text style={styles.chipText}>
                {t.type === 'channel' ? `#${t.name}` : t.name}
              </Text>
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Targets List */}
      <FlatList
        data={filteredTargets}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderTarget}
        style={styles.targetsList}
        contentContainerStyle={styles.targetsContent}
      />
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
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginLeft: 16,
    },
    sendButton: {
      padding: 8,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    searchInput: {
      fontSize: 16,
      color: colors.text,
    },
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.soft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
    },
    chipText: {
      color: colors.text,
      fontSize: 14,
    },
    targetsList: {
      flex: 1,
    },
    targetsContent: {
      paddingVertical: 8,
    },
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    channelIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    channelHash: {
      fontSize: 18,
      color: colors.muted,
    },
    targetInfo: {
      flex: 1,
    },
    targetName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    targetSubtitle: {
      fontSize: 14,
      color: colors.muted,
      marginTop: 2,
    },
  });
