import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, fileSource, getSession, Message } from '../api';
import { RootStack } from '../navigation';
import { listen } from '../realtime';
import EmojiPicker from '../EmojiPicker';
import { Avatar, colors, RichText, time } from '../ui';
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

interface Upload {
  uri: string;
  name: string;
  type: string;
  file?: File;
}

export default function ChatScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Chat'>) {
  const { slug, channelId, title, parentId } = route.params;
  const me = getSession()?.user;
  const base = `/w/${slug}/c/${channelId}/messages`;

  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
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
  const savedDraft = useRef('');
  const submitting = useRef(false);

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
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Huddle', { slug, channelId, title })}>
              <Text style={styles.headerLink}>Huddle</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('ChannelInfo', { slug, channelId, title })}>
              <Text style={styles.headerLink}>Details</Text>
            </Pressable>
            </View>
          ),
    });
  }, [navigation, title, parentId, slug, channelId]);

  const load = useCallback(async () => {
    try {
      if (parentId) {
        const data = await api<{ parent: Message; replies: Message[] }>(`${base}/${parentId}/thread`);
        setMessages([data.parent, ...data.replies]);
      } else {
        const data = await api<{ messages: Message[]; hasMore: boolean }>(base);
        setMessages(data.messages);
        setHasMore(data.hasMore);
        api(`/w/${slug}/c/${channelId}/read`, 'POST').catch(() => {});
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [base, channelId, parentId, slug]);

  useEffect(() => {
    load();
  }, [load]);

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
        outgoing.forEach((file) =>
          form.append(
            'files[]',
            (file.file ?? { uri: file.uri, name: file.name, type: file.type }) as unknown as Blob,
          ),
        );

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

  const renderItem = ({ item }: { item: Message }) => (
    <Pressable
      accessibilityHint="Opens message actions"
      disabled={item.removed}
      onLongPress={() => setSelected(item)}
      style={styles.message}
    >
      <Avatar user={item.user} />
      <View style={styles.messageBody}>
        <View style={styles.meta}>
          <Text style={styles.author}>{item.user.name}</Text>
          {item.is_bot && <Text style={styles.appBadge}>APP</Text>}
          <Text style={styles.time}>{time(item.created_at)}</Text>
        </View>

        {item.pinned && <Text style={styles.pinned}>📌 Pinned</Text>}

        {item.removed ? (
          <Text style={styles.removed}>This message was deleted.</Text>
        ) : (
          !!item.body && <RichText text={item.body} />
        )}
        {item.edited_at && <Text style={styles.time}>(edited)</Text>}

        {item.cards.map((card, index) => (
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

        {item.attachments.map((file) =>
          file.is_image ? (
            <Image key={file.id} accessibilityLabel={file.name} source={fileSource(file.url)} style={styles.image} />
          ) : (
            <Pressable key={file.id} onPress={() => Linking.openURL(fileSource(file.url).uri)} style={styles.file}>
              <Text style={styles.link}>📎 {file.name}</Text>
            </Pressable>
          ),
        )}

        {item.reactions.length > 0 && (
          <View style={styles.reactions}>
            {item.reactions.map((reaction) => (
              <Pressable
                key={reaction.emoji}
                onPress={() => react(item, reaction.emoji)}
                style={[styles.reaction, reaction.user_ids.includes(me?.id ?? 0) && styles.reactionMine]}
              >
                <Text>{reaction.emoji} {reaction.user_ids.length}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!parentId && item.reply_count > 0 && (
          <Pressable onPress={() => navigation.push('Chat', { slug, channelId, title, parentId: item.id })}>
            <Text style={styles.link}>{item.reply_count} {item.reply_count === 1 ? 'reply' : 'replies'}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  const canEdit = selected && !selected.is_bot && selected.user.id === me?.id;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
      style={styles.screen}
    >
      <FlatList
        data={[...messages].reverse()}
        inverted
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => String(item.id)}
        onEndReached={loadOlder}
        renderItem={renderItem}
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

      {files.map((file, index) => (
        <Pressable key={`${file.name}-${index}`} onPress={() => setFiles(files.filter((_, i) => i !== index))}>
          <Text style={styles.pending}>📎 {file.name} (tap to remove)</Text>
        </Pressable>
      ))}

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
          {([['B', () => wrap('*')], ['I', () => wrap('_')], ['U', () => wrap('__')], ['S', () => wrap('~')], ['</>', () => wrap('`')], ['•', () => prefixLine('- ')], ['1.', () => prefixLine('1. ')], ['❝', () => prefixLine('> ')]] as [string, () => void][]).map(([label, run]) => (
            <Pressable key={label} accessibilityLabel={`Format ${label}`} onPress={run} style={styles.tool}>
              <Text style={styles.formatText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.composer}>
        {!editing && (
          <>
            <Pressable accessibilityLabel="Formatting" onPress={() => setShowFormat(!showFormat)} style={styles.tool}>
              <Text style={styles.formatText}>Aa</Text>
            </Pressable>
            <Pressable accessibilityLabel="Emoji" onPress={() => setEmojiFor('text')} style={styles.tool}>
              <Text style={styles.toolText}>🙂</Text>
            </Pressable>
            <Pressable accessibilityLabel="Attach a photo" onPress={pickImage} style={styles.tool}>
              <Text style={styles.toolText}>🖼</Text>
            </Pressable>
            <Pressable accessibilityLabel="Attach a file" onPress={pickFile} style={styles.tool}>
              <Text style={styles.toolText}>📎</Text>
            </Pressable>
          </>
        )}
        <TextInput
          accessibilityLabel={parentId ? 'Reply' : `Message ${title}`}
          multiline
          onChangeText={setBody}
          onSelectionChange={(event) => {
            setCursor(event.nativeEvent.selection);
            setForcedCaret(undefined);
          }}
          selection={forcedCaret}
          placeholder={parentId ? 'Reply…' : `Message ${title}`}
          style={styles.input}
          value={body}
        />
        {!editing && !parentId && !!body.trim() && (
          <Pressable accessibilityLabel="Schedule message" onPress={() => setScheduling(true)} style={styles.tool}>
            <Text style={styles.toolText}>🕒</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={sending} onPress={submit} style={styles.send}>
          <Text style={styles.sendText}>{editing ? 'Save' : 'Send'}</Text>
        </Pressable>
      </View>

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
                <Text style={styles.emoji}>➕</Text>
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
                <Text style={styles.actionText}>Reply in thread</Text>
              </Pressable>
            )}
            {selected && (
              <>
                <Pressable onPress={() => pin(selected)} style={styles.action}>
                  <Text style={styles.actionText}>{selected.pinned ? 'Unpin message' : 'Pin message'}</Text>
                </Pressable>
                <Pressable onPress={() => save(selected)} style={styles.action}>
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
                <Text style={styles.actionText}>Edit message</Text>
              </Pressable>
            )}
            {canEdit && (
              <Pressable onPress={() => selected && remove(selected)} style={styles.action}>
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
            <Text style={styles.author}>Send later</Text>
            {SCHEDULES.map(([label, at]) => (
              <Pressable key={label} onPress={() => schedule(at())} style={styles.action}>
                <Text style={styles.actionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#fff', flex: 1 },
  headerLink: { color: '#fff', fontSize: 15 },
  headerLinks: { flexDirection: 'row', gap: 14 },
  formatRow: { borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6 },
  formatText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 13 },
  suggestion: { borderTopColor: colors.line, borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  pinned: { color: '#b45309', fontSize: 12 },
  message: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  messageBody: { flex: 1, minWidth: 0 },
  meta: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
  author: { color: colors.text, fontSize: 15, fontWeight: '700' },
  appBadge: { backgroundColor: colors.line, borderRadius: 3, color: colors.muted, fontSize: 10, paddingHorizontal: 3 },
  time: { color: colors.muted, fontSize: 12 },
  removed: { color: colors.muted, fontStyle: 'italic' },
  card: { borderLeftWidth: 4, marginTop: 4, paddingLeft: 10 },
  cardTitle: { color: colors.text, fontWeight: '700' },
  field: { color: colors.text, fontSize: 15, lineHeight: 22 },
  image: { borderRadius: 8, height: 180, marginTop: 6, width: 240 },
  file: { marginTop: 6 },
  link: { color: '#0369a1', fontWeight: '600', marginTop: 4 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reaction: { backgroundColor: colors.soft, borderColor: colors.line, borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  reactionMine: { backgroundColor: '#e0f2fe', borderColor: '#0ea5e9' },
  error: { color: colors.danger, paddingHorizontal: 14, paddingVertical: 4 },
  editing: { backgroundColor: '#fef3c7', color: '#92400e', padding: 8 },
  pending: { backgroundColor: colors.soft, color: colors.text, padding: 8 },
  composer: { alignItems: 'flex-end', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: 6, padding: 8 },
  tool: { padding: 6 },
  toolText: { fontSize: 20 },
  input: { backgroundColor: colors.soft, borderRadius: 18, color: colors.text, flex: 1, fontSize: 16, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 8 },
  send: { backgroundColor: colors.brand, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  sendText: { color: '#fff', fontWeight: '700' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  emoji: { fontSize: 26 },
  action: { paddingVertical: 12 },
  actionText: { color: colors.text, fontSize: 16 },
  danger: { color: colors.danger },
});
