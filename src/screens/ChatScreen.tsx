import { useHeaderHeight } from '@react-navigation/elements';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import Ionicons, { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api, fileSource, getSession, Message } from '../api';
import { RootStack } from '../navigation';
import { listen } from '../realtime';
import EmojiPicker from '../EmojiPicker';
import { AuthImage, Avatar, RichText, time, useTheme } from '../ui';
import { ThemeColors } from '../theme';
import { matchCommands } from '../slashCommands';
import { mentionNames } from '../workspaceData';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢', '👀', '✅', '🙏', '🔥'];
const DRAFT_DELAY_MS = 800;

const tomorrowMorning = () => {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(9, 0, 0, 0);
  return at;
};

const SCHEDULES: [string, () => Date][] = [
  ['In 1 hour', () => new Date(Date.now() + 3600000)],
  ['In 3 hours', () => new Date(Date.now() + 10800000)],
  ['Tomorrow at 9:00', tomorrowMorning],
];


/** Slack folds a run of messages from one person into a single block. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const AVATAR_SIZE = 36;
const AVATAR_GAP = 10;

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

/** "Today" / "Yesterday" / "Monday, March 3" for the divider between days. */
const dayLabel = (value: Date) => {
  const days = Math.round((startOfDay(new Date()).getTime() - startOfDay(value).getTime()) / 86400000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';

  return value.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
};

interface ChannelInfo {
  type: 'public' | 'private' | 'dm';
  dmUser?: { id: number; name: string; avatar_url?: string | null; status_emoji?: string | null };
}

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: Message; grouped: boolean }
  | { kind: 'unread'; key: string }
  | { kind: 'conversation_start'; key: string; channelInfo: ChannelInfo; title: string };

/** Turns the flat message list into day dividers plus messages that know whether they continue a block. */
function buildRows(
  messages: Message[],
  firstUnreadId?: number | null,
  channelInfo?: ChannelInfo | null,
  title?: string,
  hasMore?: boolean
): Row[] {
  const rows: Row[] = [];
  let day = '';
  let previous: Message | null = null;
  let unreadInserted = false;

  // Add conversation start at the beginning if no more messages to load
  if (channelInfo && title && !hasMore) {
    rows.push({ kind: 'conversation_start', key: 'conversation-start', channelInfo, title });
  }

  for (const message of messages) {
    // Insert unread divider before the first unread message
    if (firstUnreadId && message.id === firstUnreadId && !unreadInserted) {
      rows.push({ kind: 'unread', key: 'unread-divider' });
      unreadInserted = true;
      previous = null; // Reset grouping after unread divider
    }

    const at = new Date(message.created_at);
    const key = at.toDateString();

    if (key !== day) {
      rows.push({ kind: 'day', key: `day-${key}`, label: dayLabel(at) });
      day = key;
      previous = null; // a new day always opens a fresh block
    }

    const grouped =
      previous !== null &&
      previous.user.id === message.user.id &&
      previous.is_bot === message.is_bot &&
      !previous.removed &&
      !message.removed &&
      at.getTime() - new Date(previous.created_at).getTime() < GROUP_WINDOW_MS;

    rows.push({ kind: 'message', key: `message-${message.id}`, message, grouped });
    previous = message;
  }

  return rows;
}

interface Upload {
  uri: string;
  name: string;
  type: string;
  file?: File;
}

export default function ChatScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Chat'>) {
  const { slug, channelId, title, parentId, channelType, dmUser } = route.params;
  const me = getSession()?.user;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const headerHeight = useHeaderHeight();
  const base = `/w/${slug}/c/${channelId}/messages`;

  const listRef = useRef<FlatList<Row>>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState<number | null>(null);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(
    channelType ? { type: channelType, dmUser } : null
  );
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<Upload[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showFormat, setShowFormat] = useState(false);
  const [cursor, setCursor] = useState({ start: 0, end: 0 });
  const [forcedCaret, setForcedCaret] = useState<{ start: number; end: number } | undefined>();
  const [emojiFor, setEmojiFor] = useState<'text' | Message | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [focused, setFocused] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedDraft = useRef('');
  const submitting = useRef(false);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  // After changing the text in code, the caret has to be moved by hand too.
  const change = (next: string, position: number) => {
    const caret = { start: position, end: position };
    setBody(next);
    setCursor(caret);
    setForcedCaret(caret);
  };

  const wrap = (mark: string) => {
    const { start, end } = cursor;
    const next = body.slice(0, start) + mark + body.slice(start, end) + mark + body.slice(end);
    change(next, start === end ? start + mark.length : end + mark.length * 2);
  };

  const prefixLine = (prefix: string) => {
    const lineStart = body.lastIndexOf('\n', Math.max(cursor.start - 1, 0)) + 1;
    change(body.slice(0, lineStart) + prefix + body.slice(lineStart), cursor.end + prefix.length);
  };

  const insert = (text: string) => {
    const { start, end } = cursor;
    change(body.slice(0, start) + text + body.slice(end), start + text.length);
  };

  const mentionQuery = body.slice(0, cursor.end).match(/(?:^|\s)@([^\s@]*)$/)?.[1];
  const suggestions =
    mentionQuery === undefined
      ? []
      : mentionNames(me?.id).filter((name) => name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);

  const slashOptions = editing || parentId || files.length > 0 ? [] : matchCommands(body);

  const pickMention = (name: string) => {
    const start = cursor.end - (mentionQuery?.length ?? 0) - 1;
    const mention = `@${name} `;
    change(body.slice(0, start) + mention + body.slice(cursor.end), start + mention.length);
  };

  // Drafts belong to the channel; thread replies and edits are not saved.
  useEffect(() => {
    if (parentId) return;

    api<{ channel_id: number; body: string }[]>(`/w/${slug}/drafts`)
      .then((drafts) => {
        const draft = drafts.find((item) => item.channel_id === channelId);
        if (draft) {
          savedDraft.current = draft.body;
          setBody((current) => current || draft.body);
        }
      })
      .catch(() => {});
  }, [channelId, parentId, slug]);

  useEffect(() => {
    if (parentId || editing) return;

    const timer = setTimeout(() => {
      if (submitting.current || body.trim() === savedDraft.current.trim()) return;
      savedDraft.current = body;
      api(`/w/${slug}/c/${channelId}/draft`, 'PUT', { body }).catch(() => {});
    }, DRAFT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [body, channelId, editing, parentId, slug]);

  const schedule = async (at: Date) => {
    setScheduling(false);
    submitting.current = true;
    try {
      await api(`/w/${slug}/c/${channelId}/schedule`, 'POST', { body: body.trim(), send_at: at.toISOString() });
      savedDraft.current = '';
      setBody('');
      setNotice(`Scheduled for ${at.toLocaleString()}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: parentId ? 'Thread' : title,
      headerRight: parentId
        ? undefined
        : () => (
            <View style={styles.headerLinks}>
              <Pressable
                accessibilityLabel="Huddle"
                accessibilityRole="button"
                onPress={() => navigation.navigate('Huddle', { slug, channelId, title })}
              >
                <Ionicons name="headset-outline" size={22} color={colors.text} />
              </Pressable>
              <Pressable
                accessibilityLabel="Details"
                accessibilityRole="button"
                onPress={() => navigation.navigate('ChannelInfo', { slug, channelId, title })}
              >
                <Ionicons name="information-circle-outline" size={23} color={colors.text} />
              </Pressable>
            </View>
          ),
    });
  }, [navigation, title, parentId, slug, channelId, styles, colors]);

  const load = useCallback(async () => {
    try {
      if (parentId) {
        const data = await api<{ parent: Message; replies: Message[] }>(`${base}/${parentId}/thread`);
        setMessages([data.parent, ...data.replies]);
      } else {
        const data = await api<{
          messages: Message[];
          hasMore: boolean;
          first_unread_id?: number | null;
          channel_type?: 'public' | 'private' | 'dm';
          dm_user?: { id: number; name: string; avatar_url?: string | null; status_emoji?: string | null };
        }>(base);
        setMessages(data.messages);
        setHasMore(data.hasMore);

        // Store first unread message ID for scrolling
        if (data.first_unread_id) {
          setFirstUnreadId(data.first_unread_id);
        }

        // Set channel info if available from API
        if (data.channel_type && !channelInfo) {
          setChannelInfo({ type: data.channel_type, dmUser: data.dm_user });
        }

        api(`/w/${slug}/c/${channelId}/read`, 'POST').catch(() => {});
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [base, channelId, channelInfo, parentId, slug]);

  useEffect(() => {
    load();
  }, [load]);

  // Scroll to first unread message after messages load
  useEffect(() => {
    if (!firstUnreadId || messages.length === 0 || parentId) return;

    // Find the index of the unread divider in the reversed rows
    const rowsForScroll = buildRows(messages, firstUnreadId).reverse();
    const unreadIndex = rowsForScroll.findIndex((row) => row.kind === 'unread');

    if (unreadIndex !== -1 && listRef.current) {
      // Small delay to ensure FlatList is ready
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: unreadIndex,
          animated: true,
          viewPosition: 0.5, // Center the unread divider in view
        });
        // Clear firstUnreadId after scrolling to remove the divider
        setTimeout(() => {
          setFirstUnreadId(null);
        }, 2000); // Keep divider visible for 2 seconds after scroll
      }, 300);
    }
  }, [firstUnreadId, messages.length, parentId]); // Use messages.length to avoid re-triggering on message updates

  const add = useCallback(
    (message: Message) =>
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message])),
    [],
  );

  const belongsHere = useCallback(
    (message: Message) => (parentId ? message.parent_id === parentId : message.parent_id === null),
    [parentId],
  );

  useEffect(() => {
    const channel = `private-channel.${channelId}`;
    const stops = [
      listen<Message>(channel, 'message.sent', (message) => {
        if (belongsHere(message)) {
          add(message);
          if (!parentId && message.user.id !== me?.id) api(`/w/${slug}/c/${channelId}/read`, 'POST').catch(() => {});
        } else if (message.parent_id !== null) {
          setMessages((current) =>
            current.map((m) =>
              m.id === message.parent_id ? { ...m, reply_count: message.parent_reply_count ?? m.reply_count } : m,
            ),
          );
        }
      }),
      listen<Message>(channel, 'message.updated', (message) =>
        setMessages((current) => current.map((m) => (m.id === message.id ? message : m))),
      ),
      listen<{ id: number }>(channel, 'message.deleted', ({ id }) =>
        setMessages((current) => current.filter((m) => m.id !== id)),
      ),
      listen<{ id: number; reactions: Message['reactions'] }>(channel, 'reaction.updated', ({ id, reactions }) =>
        setMessages((current) => current.map((m) => (m.id === id ? { ...m, reactions } : m))),
      ),
    ];

    return () => stops.forEach((stop) => stop());
  }, [add, belongsHere, channelId, me?.id, parentId, slug]);

  const loadOlder = async () => {
    if (!hasMore || parentId || !messages[0]) return;

    const data = await api<{ messages: Message[]; hasMore: boolean }>(`${base}?before=${messages[0].id}`);
    setMessages((current) => [...data.messages, ...current]);
    setHasMore(data.hasMore);
  };

  const submit = async () => {
    const text = body.trim();
    if ((!text && files.length === 0) || sending) return;

    const outgoing = files;

    setSending(true);
    submitting.current = true;
    setError(null);

    // The box empties now, so anything typed while this is on its way is kept.
    setBody('');
    setFiles([]);

    try {
      if (!editing && !parentId && outgoing.length === 0 && /^\/[a-z]+(\s|$)/i.test(text)) {
        const reply = await api<{ text?: string; message?: Message }>(`/w/${slug}/c/${channelId}/command`, 'POST', { text });
        if (reply.message) add(reply.message);
        setNotice(reply.text ?? null);
      } else if (editing) {
        const updated = await api<Message>(`${base}/${editing.id}`, 'PATCH', { body: text });
        setMessages((current) => current.map((m) => (m.id === updated.id ? updated : m)));
        setEditing(null);
      } else {
        const form = new FormData();
        form.append('body', text);
        if (parentId) form.append('parent_id', String(parentId));
        outgoing.forEach((file) => {
          // On web, use the File object directly if available
          // On mobile, use the uri/name/type object format
          if (file.file) {
            form.append('files[]', file.file, file.name);
          } else {
            form.append(
              'files[]',
              { uri: file.uri, name: file.name, type: file.type } as unknown as Blob,
            );
          }
        });

        const message = await api<Message>(base, 'POST', form);
        if (belongsHere(message)) add(message);
      }
      savedDraft.current = '';
    } catch (e) {
      setError((e as Error).message);
      setBody((current) => (current ? `${text}\n${current}` : text));
      setFiles((current) => [...outgoing, ...current]);
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.assets?.[0];

    if (!result.canceled && asset) {
      setFiles((current) =>
        [...current, {
          uri: asset.uri,
          name: asset.fileName ?? 'photo.jpg',
          type: asset.mimeType ?? 'image/jpeg',
          file: asset.file,
        }].slice(0, 3),
      );
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = result.assets?.[0];

    if (!result.canceled && asset) {
      setFiles((current) =>
        [...current, {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'application/octet-stream',
          file: asset.file,
        }].slice(0, 3),
      );
    }
  };

  const react = async (message: Message, emoji: string) => {
    setSelected(null);
    const data = await api<{ reactions: Message['reactions'] }>(`${base}/${message.id}/reactions`, 'POST', { emoji });
    setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, reactions: data.reactions } : m)));
  };

  const pin = async (message: Message) => {
    setSelected(null);
    const updated = await api<Message>(`${base}/${message.id}/pin`, 'POST');
    setMessages((current) => current.map((m) => (m.id === updated.id ? updated : m)));
  };

  const save = async (message: Message) => {
    setSelected(null);
    const { saved } = await api<{ saved: boolean }>(`${base}/${message.id}/save`, 'POST');
    setNotice(saved ? 'Saved for later.' : 'Removed from saved items.');
  };

  const remove = async (message: Message) => {
    setSelected(null);
    try {
      await api(`${base}/${message.id}`, 'DELETE');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const renderMessage = (message: Message, grouped: boolean) => (
    <Pressable
      accessibilityHint="Opens message actions"
      disabled={message.removed}
      onLongPress={() => setSelected(message)}
      style={[styles.message, grouped && styles.messageGrouped]}
    >
      {grouped ? <View style={styles.avatarSpacer} /> : <Avatar user={message.user} size={AVATAR_SIZE} />}
      <View style={styles.messageBody}>
        {!grouped && (
          <View style={styles.meta}>
            <Text style={styles.author}>{message.user.name}</Text>
            {message.is_bot && <Text style={styles.appBadge}>APP</Text>}
            <Text style={styles.time}>{time(message.created_at)}</Text>
          </View>
        )}

        {message.pinned && (
          <View style={styles.pinnedRow}>
            <Ionicons name="pin" size={12} color={colors.muted} />
            <Text style={styles.pinned}>Pinned</Text>
          </View>
        )}

        {message.removed ? (
          <Text style={styles.removed}>This message was deleted.</Text>
        ) : (
          !!message.body && <RichText text={message.body} />
        )}
        {message.edited_at && <Text style={styles.time}>(edited)</Text>}

        {message.cards.map((card, index) => (
          <View key={index} style={[styles.card, { borderLeftColor: card.color }]}>
            {!!card.title && <Text style={styles.cardTitle}>{card.title}</Text>}
            {!!card.text && <RichText text={card.text} />}
            {card.fields.map((field, fieldIndex) => (
              <Text key={fieldIndex} style={styles.field}>
                <Text style={styles.cardTitle}>{field.title}: </Text>
                {field.value}
              </Text>
            ))}
          </View>
        ))}

        {message.attachments.map((file) =>
          file.is_image ? (
            <Pressable
              key={file.id}
              onPress={() =>
                navigation.navigate('ImageViewer', {
                  slug,
                  fileId: file.id,
                  fileUrl: file.url,
                  fileName: file.name,
                  userName: message.user.name,
                  userAvatar: message.user.avatar_url ?? undefined,
                  timestamp: time(message.created_at),
                  sharedIn: `#${title.replace('#', '')}`,
                })
              }
              style={styles.imageContainer}
            >
              <AuthImage
                path={file.url}
                style={styles.image}
                onLoad={() => console.log('Image loaded:', file.name)}
                onError={(err) => console.log('Image error:', err)}
                placeholder={
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={32} color={colors.muted} />
                  </View>
                }
              />
            </Pressable>
          ) : (
            <Pressable key={file.id} onPress={() => Linking.openURL(fileSource(file.url).uri)} style={styles.file}>
              <Ionicons name="document-outline" size={15} color={colors.accent} />
              <Text style={styles.link}>{file.name}</Text>
            </Pressable>
          ),
        )}

        {message.reactions.length > 0 && (
          <View style={styles.reactions}>
            {message.reactions.map((reaction) => (
              <Pressable
                key={reaction.emoji}
                onPress={() => react(message, reaction.emoji)}
                style={[styles.reaction, reaction.user_ids.includes(me?.id ?? 0) && styles.reactionMine]}
              >
                <Text style={styles.reactionText}>{reaction.emoji} {reaction.user_ids.length}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setEmojiFor(message)} style={styles.reactionAdd}>
              <Ionicons name="happy-outline" size={15} color={colors.muted} />
              <Ionicons name="add" size={11} color={colors.muted} />
            </Pressable>
          </View>
        )}

        {!parentId && message.reply_count > 0 && (
          <Pressable
            onPress={() => navigation.push('Chat', { slug, channelId, title, parentId: message.id })}
            style={styles.replyRow}
          >
            <Text style={styles.replyText}>
              {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
            </Text>
            <Ionicons name="chevron-forward" size={13} color={colors.accent} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'day') {
      return (
        <View style={styles.dayRow}>
          <View style={styles.dayLine} />
          <Text style={styles.dayLabel}>{item.label}</Text>
          <View style={styles.dayLine} />
        </View>
      );
    }

    if (item.kind === 'unread') {
      return (
        <View style={styles.unreadRow}>
          <View style={styles.unreadLine} />
          <Text style={styles.unreadLabel}>New</Text>
          <View style={styles.unreadLine} />
        </View>
      );
    }

    if (item.kind === 'conversation_start') {
      const { channelInfo: info, title: channelTitle } = item;
      const isDm = info.type === 'dm' && info.dmUser;
      const displayName = isDm ? info.dmUser!.name : channelTitle.replace('#', '');

      return (
        <View style={styles.conversationStart}>
          {isDm ? (
            <>
              <View style={styles.conversationAvatar}>
                {info.dmUser!.avatar_url ? (
                  <Image
                    source={fileSource(info.dmUser!.avatar_url)}
                    style={styles.conversationAvatarImage}
                  />
                ) : (
                  <View style={styles.conversationAvatarPlaceholder}>
                    <Ionicons name="person" size={40} color={colors.textSecondary} />
                  </View>
                )}
              </View>
              <View style={styles.conversationNameRow}>
                <Text style={styles.conversationName}>{displayName}</Text>
                {info.dmUser!.status_emoji && (
                  <Text style={styles.conversationStatus}>{info.dmUser!.status_emoji}</Text>
                )}
              </View>
              <Text style={styles.conversationDesc}>
                This is the very beginning of your direct message history with {displayName}. Only the two of you are in this conversation.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.conversationChannelIcon}>
                <Ionicons
                  name={info.type === 'private' ? 'lock-closed' : 'grid'}
                  size={40}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={styles.conversationName}>
                {info.type === 'private' ? '' : '#'}{displayName}
              </Text>
              <Text style={styles.conversationDesc}>
                This is the very beginning of the {channelTitle} channel.
              </Text>
            </>
          )}
        </View>
      );
    }

    return renderMessage(item.message, item.grouped);
  };

  // The list is inverted, so the newest row has to come first.
  const rows = useMemo(
    () => buildRows(messages, firstUnreadId, parentId ? null : channelInfo, title, hasMore).reverse(),
    [messages, firstUnreadId, channelInfo, title, hasMore, parentId]
  );

  const canEdit = selected && !selected.is_bot && selected.user.id === me?.id;
  const canSend = !!body.trim() || files.length > 0;
  // The pill opens while typing, while a tool sheet is up, or whenever there is content.
  const expanded = focused || canSend || !!editing || showFormat || attaching || emojiFor === 'text';

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={styles.screen}
    >
      <FlatList
        ref={listRef}
        data={rows}
        inverted
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.key}
        onEndReached={loadOlder}
        renderItem={renderRow}
        onScrollToIndexFailed={(info) => {
          // If scroll fails (item not yet rendered), wait and retry
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
              viewPosition: 0.5,
            });
          }, 500);
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {notice && (
        <Pressable onPress={() => setNotice(null)}>
          <Text style={styles.pending}>{notice}</Text>
        </Pressable>
      )}

      {editing && (
        <Pressable onPress={() => { setEditing(null); setBody(''); }}>
          <Text style={styles.editing}>Editing a message. Tap to cancel.</Text>
        </Pressable>
      )}

      {files.length > 0 && (
        <View style={styles.filesPreview}>
          {files.map((file, index) => {
            const isImage = file.type.startsWith('image/');
            return (
              <View key={`${file.name}-${index}`} style={styles.filePreviewItem}>
                {isImage ? (
                  <Image source={{ uri: file.uri }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.fileIconContainer}>
                    <Ionicons name="document-outline" size={24} color={colors.textSecondary} />
                  </View>
                )}
                <Pressable
                  accessibilityLabel={`Remove ${file.name}`}
                  onPress={() => setFiles(files.filter((_, i) => i !== index))}
                  style={styles.removeFileButton}
                >
                  <Ionicons name="close-circle" size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.filePreviewName} numberOfLines={1}>{file.name}</Text>
              </View>
            );
          })}
        </View>
      )}

      {slashOptions.map((option) => (
        <Pressable key={option.insert} accessibilityRole="button" onPress={() => change(option.insert, option.insert.length)} style={styles.suggestion}>
          <Text style={styles.actionText}>{option.insert.trimEnd()}</Text>
          <Text style={styles.hint}>{option.hint}</Text>
        </Pressable>
      ))}

      {suggestions.map((name) => (
        <Pressable key={name} accessibilityRole="button" onPress={() => pickMention(name)} style={styles.suggestion}>
          <Text style={styles.actionText}>@{name}</Text>
        </Pressable>
      ))}

      {showFormat && (
        <View style={styles.formatRow}>
          <Pressable accessibilityLabel="Bold" onPress={() => wrap('*')} style={styles.tool}>
            <Text style={[styles.formatText, styles.formatBold]}>B</Text>
          </Pressable>
          <Pressable accessibilityLabel="Italic" onPress={() => wrap('_')} style={styles.tool}>
            <Text style={[styles.formatText, styles.formatItalic]}>I</Text>
          </Pressable>
          <Pressable accessibilityLabel="Underline" onPress={() => wrap('__')} style={styles.tool}>
            <Text style={[styles.formatText, styles.formatUnderline]}>U</Text>
          </Pressable>
          <Pressable accessibilityLabel="Strikethrough" onPress={() => wrap('~')} style={styles.tool}>
            <Text style={[styles.formatText, styles.formatStrike]}>S</Text>
          </Pressable>

          <View style={styles.formatDivider} />

          <Pressable accessibilityLabel="Code" onPress={() => wrap('`')} style={styles.tool}>
            <Ionicons name="code-slash" size={19} color={colors.textSecondary} />
          </Pressable>
          <Pressable accessibilityLabel="Bulleted list" onPress={() => prefixLine('- ')} style={styles.tool}>
            <Ionicons name="list" size={19} color={colors.textSecondary} />
          </Pressable>
          <Pressable accessibilityLabel="Numbered list" onPress={() => prefixLine('1. ')} style={styles.tool}>
            <Text style={styles.formatText}>1.</Text>
          </Pressable>
          <Pressable accessibilityLabel="Blockquote" onPress={() => prefixLine('> ')} style={styles.tool}>
            <Text style={styles.formatQuote}>&#8220;</Text>
          </Pressable>
        </View>
      )}

      {/* Slack keeps the composer as one slim pill until you tap it, then opens it
          into a text area with its tool row underneath. */}
      <View style={[styles.composer, expanded ? styles.composerExpanded : styles.composerCollapsed]}>
        {expanded && <View style={styles.grabber} />}

        <View style={expanded ? styles.inputRowExpanded : styles.inputRowCollapsed}>
          {!expanded && (
            <Pressable accessibilityLabel="Attach" onPress={() => setAttaching(true)} style={styles.plusFilled}>
              <Ionicons name="add" size={21} color={colors.textSecondary} />
            </Pressable>
          )}

          <TextInput
            accessibilityLabel={parentId ? 'Reply' : `Message ${title}`}
            multiline
            onBlur={() => {
              // A tap on a tool blurs the field first, so the collapse waits for it.
              blurTimer.current = setTimeout(() => setFocused(false), 150);
            }}
            onChangeText={setBody}
            onFocus={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current);
              setFocused(true);
            }}
            onSelectionChange={(event) => {
              setCursor(event.nativeEvent.selection);
              setForcedCaret(undefined);
            }}
            placeholder={parentId ? 'Reply…' : `Message ${title}`}
            placeholderTextColor={colors.muted}
            selection={forcedCaret}
            style={[styles.input, expanded && styles.inputExpanded]}
            value={body}
          />

          {!expanded && (
            <Pressable accessibilityLabel="Record audio" style={styles.tool}>
              <Ionicons name="mic-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {expanded && (
          <View style={styles.toolRow}>
            <Pressable accessibilityLabel="Attach" onPress={() => setAttaching(true)} style={styles.plusOutline}>
              <Ionicons name="add" size={19} color={colors.textSecondary} />
            </Pressable>
            <Pressable accessibilityLabel="Formatting" onPress={() => setShowFormat(!showFormat)} style={styles.tool}>
              <Text style={[styles.formatText, showFormat && styles.toolActive]}>Aa</Text>
            </Pressable>
            <Pressable accessibilityLabel="Emoji" onPress={() => setEmojiFor('text')} style={styles.tool}>
              <Ionicons name="happy-outline" size={21} color={colors.textSecondary} />
            </Pressable>
            <Pressable accessibilityLabel="Mention someone" onPress={() => insert('@')} style={styles.tool}>
              <Ionicons name="at-outline" size={21} color={colors.textSecondary} />
            </Pressable>
            <Pressable accessibilityLabel="Slash command" onPress={() => insert('/')} style={styles.slashButton}>
              <Text style={styles.slashText}>/</Text>
            </Pressable>

            <View style={styles.toolSpacer} />

            <Pressable
              accessibilityHint="Hold to schedule this message"
              accessibilityLabel={editing ? 'Save' : 'Send'}
              accessibilityRole="button"
              disabled={sending || !canSend}
              onLongPress={() => !editing && !parentId && canSend && setScheduling(true)}
              onPress={submit}
              style={styles.tool}
            >
              <Ionicons
                name={editing ? 'checkmark' : 'send'}
                size={21}
                color={canSend && !sending ? colors.primary : colors.muted}
              />
            </Pressable>
          </View>
        )}
      </View>

      {/* Photos and files live behind the + button, the way Slack hides them. */}
      <Modal animationType="fade" onRequestClose={() => setAttaching(false)} transparent visible={attaching}>
        <Pressable onPress={() => setAttaching(false)} style={styles.backdrop}>
          <View style={styles.sheet}>
            <Pressable
              onPress={() => {
                setAttaching(false);
                pickImage();
              }}
              style={styles.action}
            >
              <Ionicons name="images-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.actionText}>Photo or video</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setAttaching(false);
                pickFile();
              }}
              style={styles.action}
            >
              <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.actionText}>File</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setSelected(null)} transparent visible={selected !== null}>
        <Pressable onPress={() => setSelected(null)} style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.emojiRow}>
              <Pressable
                accessibilityLabel="More emoji"
                onPress={() => {
                  setEmojiFor(selected);
                  setSelected(null);
                }}
              >
                <Ionicons name="add-circle-outline" size={26} color={colors.textSecondary} />
              </Pressable>
              {EMOJIS.map((emoji) => (
                <Pressable key={emoji} accessibilityLabel={`React with ${emoji}`} onPress={() => selected && react(selected, emoji)}>
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            {!parentId && (
              <Pressable
                onPress={() => {
                  const id = selected?.id;
                  setSelected(null);
                  if (id) navigation.push('Chat', { slug, channelId, title, parentId: id });
                }}
                style={styles.action}
              >
                <Ionicons name="return-down-forward-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.actionText}>Reply in thread</Text>
              </Pressable>
            )}
            {selected && (
              <>
                {/* Mark unread */}
                <Pressable
                  onPress={async () => {
                    try {
                      await api(`/w/${slug}/c/${channelId}/unread`, 'POST', { message_id: selected.id });
                      setSelected(null);
                      setNotice('Marked as unread');
                    } catch (e) {
                      setError((e as Error).message);
                      setSelected(null);
                    }
                  }}
                  style={styles.action}
                >
                  <Ionicons name="mail-unread-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Mark unread</Text>
                </Pressable>

                {/* Add a reminder */}
                <Pressable
                  onPress={() => {
                    setSelected(null);
                    Alert.alert(
                      'Set a reminder',
                      'When do you want to be reminded?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'In 20 minutes',
                          onPress: async () => {
                            const remindAt = new Date(Date.now() + 20 * 60 * 1000);
                            await api(`/w/${slug}/c/${channelId}/messages/${selected.id}/remind`, 'POST', { remind_at: remindAt.toISOString() }).catch(() => {});
                            setNotice('Reminder set for 20 minutes');
                          },
                        },
                        {
                          text: 'In 1 hour',
                          onPress: async () => {
                            const remindAt = new Date(Date.now() + 60 * 60 * 1000);
                            await api(`/w/${slug}/c/${channelId}/messages/${selected.id}/remind`, 'POST', { remind_at: remindAt.toISOString() }).catch(() => {});
                            setNotice('Reminder set for 1 hour');
                          },
                        },
                        {
                          text: 'Tomorrow',
                          onPress: async () => {
                            const remindAt = new Date();
                            remindAt.setDate(remindAt.getDate() + 1);
                            remindAt.setHours(9, 0, 0, 0);
                            await api(`/w/${slug}/c/${channelId}/messages/${selected.id}/remind`, 'POST', { remind_at: remindAt.toISOString() }).catch(() => {});
                            setNotice('Reminder set for tomorrow at 9:00 AM');
                          },
                        },
                      ]
                    );
                  }}
                  style={styles.action}
                >
                  <Ionicons name="alarm-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Remind me about this</Text>
                </Pressable>

                {/* Copy link */}
                <Pressable
                  onPress={async () => {
                    const session = getSession();
                    const link = `${session?.server}/w/${slug}/c/${channelId}/p/${selected.id}`;
                    await Clipboard.setStringAsync(link);
                    setSelected(null);
                    setNotice('Link copied to clipboard');
                  }}
                  style={styles.action}
                >
                  <Ionicons name="link-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Copy link</Text>
                </Pressable>

                {/* Copy message */}
                <Pressable
                  onPress={async () => {
                    await Clipboard.setStringAsync(selected.body || '');
                    setSelected(null);
                    setNotice('Message copied to clipboard');
                  }}
                  style={styles.action}
                >
                  <Ionicons name="copy-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Copy text</Text>
                </Pressable>

                <Pressable onPress={() => pin(selected)} style={styles.action}>
                  <Ionicons name={selected.pinned ? 'pin' : 'pin-outline'} size={20} color={colors.textSecondary} />
                  <Text style={styles.actionText}>{selected.pinned ? 'Unpin message' : 'Pin message'}</Text>
                </Pressable>
                <Pressable onPress={() => save(selected)} style={styles.action}>
                  <Ionicons name="bookmark-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Save for later</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const messageId = selected.id;
                    setSelected(null);
                    navigation.navigate('Forward', { slug, channelId, messageId });
                  }}
                  style={styles.action}
                >
                  <Ionicons name="arrow-redo-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Forward message</Text>
                </Pressable>
              </>
            )}
            {canEdit && (
              <Pressable
                onPress={() => {
                  setEditing(selected);
                  setBody(selected?.body ?? '');
                  setSelected(null);
                }}
                style={styles.action}
              >
                <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.actionText}>Edit message</Text>
              </Pressable>
            )}
            {canEdit && (
              <Pressable onPress={() => selected && remove(selected)} style={styles.action}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={[styles.actionText, styles.danger]}>Delete message</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      {emojiFor && (
        <EmojiPicker
          allowCustom={emojiFor === 'text'}
          onClose={() => setEmojiFor(null)}
          onPick={(emoji) => {
            const target = emojiFor;
            setEmojiFor(null);
            if (target === 'text') insert(emoji);
            else react(target, emoji);
          }}
        />
      )}

      <Modal animationType="fade" onRequestClose={() => setScheduling(false)} transparent visible={scheduling}>
        <Pressable onPress={() => setScheduling(false)} style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Send later</Text>
            {SCHEDULES.map(([label, at]) => (
              <Pressable key={label} onPress={() => schedule(at())} style={styles.action}>
                <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.actionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { backgroundColor: colors.messageBg, flex: 1 },
    headerLinks: { alignItems: 'center', flexDirection: 'row', gap: 16 },

    // Day divider: a centred label on a hairline, the way Slack breaks up a channel.
    dayRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
    dayLine: { backgroundColor: colors.line, flex: 1, height: 1 },
    dayLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },

    // Unread divider: a red line with "New" label
    unreadRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
    unreadLine: { backgroundColor: colors.danger, flex: 1, height: 1 },
    unreadLabel: { color: colors.danger, fontSize: 12, fontWeight: '700' },

    // Conversation start header
    conversationStart: {
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    conversationAvatar: {
      marginBottom: 12,
    },
    conversationAvatarImage: {
      width: 72,
      height: 72,
      borderRadius: 8,
      backgroundColor: colors.soft,
    },
    conversationAvatarPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 8,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    conversationChannelIcon: {
      width: 72,
      height: 72,
      borderRadius: 8,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    conversationNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    conversationName: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    conversationStatus: {
      fontSize: 18,
    },
    conversationDesc: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'left',
    },

    // A message opens a block; a grouped one tucks under it with no avatar or name.
    message: { backgroundColor: colors.messageBg, flexDirection: 'row', gap: AVATAR_GAP, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 },
    messageGrouped: { paddingTop: 1 },
    avatarSpacer: { width: AVATAR_SIZE },
    messageBody: { flex: 1, minWidth: 0 },
    meta: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
    author: { color: colors.text, fontSize: 15, fontWeight: '900' },
    appBadge: {
      backgroundColor: colors.line,
      borderRadius: 3,
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    time: { color: colors.muted, fontSize: 12 },
    removed: { color: colors.muted, fontStyle: 'italic' },
    pinnedRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginBottom: 2 },
    pinned: { color: colors.muted, fontSize: 12, fontWeight: '600' },

    card: { borderLeftWidth: 4, borderRadius: 4, backgroundColor: colors.cardBg, marginTop: 4, padding: 8, paddingLeft: 10 },
    cardTitle: { color: colors.text, fontWeight: '700' },
    field: { color: colors.text, fontSize: 15, lineHeight: 22 },
    imageContainer: { marginTop: 6 },
    image: { borderRadius: 8, height: 180, width: 240, backgroundColor: colors.soft },
    imagePlaceholder: {
      width: 240,
      height: 180,
      borderRadius: 8,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    file: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 6 },
    link: { color: colors.accent, fontWeight: '600' },

    reactions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    reaction: {
      alignItems: 'center',
      backgroundColor: colors.soft,
      borderColor: colors.line,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    reactionMine: { backgroundColor: colors.hoverBg, borderColor: colors.accent },
    reactionText: { color: colors.text, fontSize: 13 },
    reactionAdd: {
      alignItems: 'center',
      backgroundColor: colors.soft,
      borderColor: colors.line,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 7,
      paddingVertical: 3,
    },

    replyRow: { alignItems: 'center', flexDirection: 'row', gap: 3, marginTop: 4, paddingVertical: 2 },
    replyText: { color: colors.accent, fontSize: 13, fontWeight: '700' },

    error: { color: colors.danger, paddingHorizontal: 16, paddingVertical: 6 },
    editing: { backgroundColor: colors.soft, color: colors.warning, padding: 10 },
    pending: { backgroundColor: colors.soft, color: colors.text, padding: 8 },
    pendingRow: {
      alignItems: 'center',
      backgroundColor: colors.soft,
      borderTopColor: colors.line,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    pendingText: { color: colors.text, flex: 1, fontSize: 14 },

    filesPreview: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.dark,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    filePreviewItem: {
      position: 'relative',
      alignItems: 'center',
    },
    imagePreview: {
      width: 70,
      height: 70,
      borderRadius: 8,
      backgroundColor: colors.soft,
    },
    fileIconContainer: {
      width: 70,
      height: 70,
      borderRadius: 8,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeFileButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.dark,
      borderRadius: 10,
    },
    filePreviewName: {
      color: colors.textSecondary,
      fontSize: 10,
      marginTop: 4,
      maxWidth: 70,
      textAlign: 'center',
    },

    suggestion: { backgroundColor: colors.dark, borderTopColor: colors.line, borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
    hint: { color: colors.muted, fontSize: 13 },

    formatRow: {
      alignItems: 'center',
      backgroundColor: colors.dark,
      borderTopColor: colors.line,
      borderTopWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    formatText: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
    formatBold: { fontWeight: '900' },
    formatItalic: { fontStyle: 'italic', fontWeight: '600' },
    formatUnderline: { textDecorationLine: 'underline' },
    formatStrike: { textDecorationLine: 'line-through' },
    formatQuote: { color: colors.textSecondary, fontSize: 22, fontWeight: '900', lineHeight: 24 },
    formatDivider: { backgroundColor: colors.line, height: 20, marginHorizontal: 8, width: 1 },

    composer: { backgroundColor: colors.dark, paddingHorizontal: 10 },
    composerCollapsed: { paddingBottom: 10, paddingTop: 6 },
    composerExpanded: { paddingBottom: 8, paddingTop: 6 },

    // The little grab handle Slack puts on top of the open composer.
    grabber: {
      alignSelf: 'center',
      backgroundColor: colors.line,
      borderRadius: 2,
      height: 4,
      marginBottom: 8,
      width: 36,
    },

    inputRowCollapsed: {
      alignItems: 'center',
      backgroundColor: colors.soft,
      borderRadius: 24,
      flexDirection: 'row',
      paddingHorizontal: 6,
      paddingVertical: 4,
    },
    inputRowExpanded: { backgroundColor: 'transparent' },

    input: { color: colors.text, flex: 1, fontSize: 16, maxHeight: 120, paddingHorizontal: 10, paddingVertical: 8 },
    inputExpanded: { flex: 0, paddingHorizontal: 4, paddingVertical: 4 },

    plusFilled: {
      alignItems: 'center',
      backgroundColor: colors.hoverBg,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    plusOutline: {
      alignItems: 'center',
      borderColor: colors.line,
      borderRadius: 15,
      borderWidth: 1,
      height: 30,
      justifyContent: 'center',
      marginRight: 4,
      width: 30,
    },

    toolRow: { alignItems: 'center', flexDirection: 'row', gap: 4, paddingTop: 6 },
    toolSpacer: { flex: 1 },
    tool: { paddingHorizontal: 6, paddingVertical: 4 },
    toolActive: { color: colors.accent },
    slashButton: {
      alignItems: 'center',
      borderColor: colors.line,
      borderRadius: 6,
      borderWidth: 1,
      height: 26,
      justifyContent: 'center',
      marginLeft: 2,
      width: 26,
    },
    slashText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },

    backdrop: { backgroundColor: 'rgba(0,0,0,0.45)', flex: 1, justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.dark, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28 },
    sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
    emojiRow: {
      alignItems: 'center',
      borderBottomColor: colors.line,
      borderBottomWidth: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 6,
      paddingBottom: 12,
    },
    emoji: { fontSize: 26 },
    action: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingVertical: 13 },
    actionText: { color: colors.text, fontSize: 16 },
    danger: { color: colors.danger },
  });
