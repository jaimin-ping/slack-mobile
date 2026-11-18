import Ionicons from '@react-native-vector-icons/ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, User, getSession } from '../api';
import { RootStack } from '../navigation';
import { Avatar, useTheme } from '../ui';
import { ThemeColors } from '../theme';

interface Member {
  user: User;
  selected: boolean;
}

export default function NewMessageScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStack, 'NewMessage'>) {
  const { slug } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const me = getSession()?.user;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    try {
      const data = await api<{ members: User[] }>(`/w/${slug}`);
      setMembers(
        data.members
          .filter((m) => m.id !== me?.id)
          .map((user) => ({ user, selected: false }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [slug, me?.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const toggleMember = (userId: number) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.user.id === userId ? { ...m, selected: !m.selected } : m
      )
    );
  };

  const filteredMembers = members.filter(
    (m) =>
      m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMembers = members.filter((m) => m.selected);

  const sendMessage = async () => {
    if (!message.trim() || selectedMembers.length === 0) return;

    try {
      // For single user, create/get DM channel
      if (selectedMembers.length === 1) {
        const { channel_id } = await api<{ channel_id: number }>(
          `/w/${slug}/dm/${selectedMembers[0].user.id}`,
          'POST'
        );

        // Send the message
        await api(`/w/${slug}/c/${channel_id}/messages`, 'POST', {
          body: message.trim(),
        });

        // Navigate to chat
        navigation.replace('Chat', {
          slug,
          channelId: channel_id,
          title: selectedMembers[0].user.name,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const renderMember = ({ item }: { item: Member }) => (
    <Pressable style={styles.memberRow} onPress={() => toggleMember(item.user.id)}>
      <Avatar user={item.user} size={40} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.user.name}</Text>
        <Text style={styles.memberUsername}>{item.user.name}</Text>
      </View>
      <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
        {item.selected && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={styles.headerRight} />
      </View>

      {/* To Field */}
      <View style={styles.toField}>
        <Text style={styles.toLabel}>To:</Text>
        <TextInput
          style={styles.toInput}
          placeholder="Add a channel or person"
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* External People Option */}
      <Pressable style={styles.externalOption}>
        <Ionicons name="people-outline" size={24} color={colors.textSecondary} />
        <Text style={styles.externalText}>Message with external people</Text>
      </Pressable>

      {/* Members List */}
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.user.id.toString()}
        renderItem={renderMember}
        style={styles.membersList}
        contentContainerStyle={styles.membersContent}
      />

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.messageInput}
          placeholder="Start a new message"
          placeholderTextColor={colors.muted}
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <View style={styles.composerRow}>
          <Pressable style={styles.plusButton}>
            <Ionicons name="add" size={22} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.toolButton}>
            <Text style={styles.toolText}>Aa</Text>
          </Pressable>
          <Pressable style={styles.toolButton}>
            <Ionicons name="happy-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.toolButton}>
            <Ionicons name="at-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.slashButton}>
            <Text style={styles.slashText}>/</Text>
          </Pressable>
          <View style={styles.spacer} />
          <Pressable
            style={styles.sendButton}
            onPress={sendMessage}
            disabled={!message.trim() || selectedMembers.length === 0}
          >
            <Ionicons
              name="send"
              size={22}
              color={message.trim() && selectedMembers.length > 0 ? colors.primary : colors.muted}
            />
          </Pressable>
        </View>
      </View>
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
    headerRight: {
      width: 32,
    },
    toField: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    toLabel: {
      fontSize: 16,
      color: colors.muted,
      marginRight: 8,
    },
    toInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    externalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    externalText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    membersList: {
      flex: 1,
    },
    membersContent: {
      paddingVertical: 8,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    memberUsername: {
      fontSize: 14,
      color: colors.muted,
      marginTop: 2,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    composer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: colors.dark,
    },
    messageInput: {
      fontSize: 16,
      color: colors.text,
      minHeight: 40,
      maxHeight: 120,
      paddingVertical: 8,
      marginBottom: 8,
    },
    composerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    plusButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    toolText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    slashButton: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slashText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    spacer: {
      flex: 1,
    },
    sendButton: {
      padding: 8,
    },
  });
