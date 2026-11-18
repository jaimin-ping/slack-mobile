import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { api, Channel, fileSource, getSession, Message, User } from '../api';
import { RootStack } from '../navigation';
import { Avatar, RichText, time, useTheme } from '../ui';
import { ThemeColors } from '../theme';
import { getExtras } from '../workspaceData';

const errorText = (e: unknown) => (e as Error).message;

function Button({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, danger && styles.dangerButton]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

interface BrowseItem {
  id: number;
  name: string;
  type: 'public' | 'private';
  topic: string | null;
  member_count: number;
  joined: boolean;
  archived: boolean;
}

export function BrowseScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Browse'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug } = route.params;
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<BrowseItem[]>(`/w/${slug}/browse`).then(setItems).catch((e) => setError(errorText(e)));
  }, [slug]);

  const open = (item: BrowseItem) => navigation.replace('Chat', { slug, channelId: item.id, title: `#${item.name}` });

  const join = async (item: BrowseItem) => {
    try {
      await api(`/w/${slug}/c/${item.id}/join`, 'POST');
      open(item);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <View style={styles.screen}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={items.filter((item) => !item.archived)}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.rowLine}>
            <View style={styles.grow}>
              <Text style={styles.title}>{item.type === 'private' ? '🔒 ' : '# '}{item.name}</Text>
              <Text style={styles.label}>
                {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
                {item.topic ? ` · ${item.topic}` : ''}
              </Text>
            </View>
            <Button label={item.joined ? 'Open' : 'Join'} onPress={() => (item.joined ? open(item) : join(item))} />
          </View>
        )}
      />
    </View>
  );
}

export function NewChannelScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'NewChannel'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug } = route.params;
  const [name, setName] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    try {
      const { channel_id } = await api<{ channel_id: number }>(`/w/${slug}/channels`, 'POST', { name, is_private: isPrivate });
      navigation.replace('Chat', { slug, channelId: channel_id, title: `#${name.trim().toLowerCase().replace(/\s+/g, '-')}` });
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <View style={[styles.screen, styles.padded]}>
      <Text style={styles.label}>Channel name</Text>
      <TextInput accessibilityLabel="Channel name" autoCapitalize="none" onChangeText={setName} style={styles.input} value={name} />
      <View style={styles.switchRow}>
        <Text style={styles.body}>Make private</Text>
        <Switch accessibilityLabel="Make private" onValueChange={setPrivate} value={isPrivate} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Create channel" onPress={create} />
    </View>
  );
}

export function SavedScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Saved'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug } = route.params;
  const [items, setItems] = useState<(Message & { channel_label: string })[] | null>(null);

  useEffect(() => {
    api<(Message & { channel_label: string })[]>(`/w/${slug}/saved`).then(setItems).catch(() => setItems([]));
  }, [slug]);

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={items ? <Text style={styles.empty}>Messages you save show up here.</Text> : undefined}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigation.navigate('Chat', {
              slug,
              channelId: item.channel_id,
              title: item.channel_label,
              parentId: item.parent_id ?? undefined,
            })
          }
          style={styles.row}
        >
          <Text style={styles.label}>{item.channel_label} · {time(item.created_at)}</Text>
          <Text style={styles.title}>{item.user.name}</Text>
          <Text numberOfLines={2} style={styles.body}>{item.body || item.cards[0]?.title}</Text>
        </Pressable>
      )}
      style={styles.screen}
    />
  );
}

interface DraftItem {
  id: number;
  channel_id: number;
  channel_label: string;
  body: string;
}

export function DraftsScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Drafts'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug } = route.params;
  const [items, setItems] = useState<DraftItem[] | null>(null);

  useEffect(() => {
    api<DraftItem[]>(`/w/${slug}/drafts`).then(setItems).catch(() => setItems([]));
  }, [slug]);

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={items ? <Text style={styles.empty}>Unsent messages are saved here.</Text> : undefined}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Chat', { slug, channelId: item.channel_id, title: item.channel_label })}
          style={styles.row}
        >
          <Text style={styles.label}>{item.channel_label}</Text>
          <Text numberOfLines={2} style={styles.body}>{item.body}</Text>
        </Pressable>
      )}
      style={styles.screen}
    />
  );
}

interface ReminderItem {
  id: number;
  text: string;
  remind_at: string;
}

interface ScheduledItem {
  id: number;
  channel_label: string;
  body: string;
  send_at: string;
  failed: boolean;
}

export function ScheduledScreen({ route }: NativeStackScreenProps<RootStack, 'Scheduled'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug } = route.params;
  const [items, setItems] = useState<ScheduledItem[] | null>(null);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  useEffect(() => {
    api<ScheduledItem[]>(`/w/${slug}/scheduled`).then(setItems).catch(() => setItems([]));
    api<ReminderItem[]>(`/w/${slug}/reminders`).then(setReminders).catch(() => setReminders([]));
  }, [slug]);

  const cancelReminder = async (id: number) => {
    await api(`/w/${slug}/reminders/${id}`, 'DELETE');
    setReminders((current) => current.filter((item) => item.id !== id));
  };

  const cancel = async (id: number) => {
    await api(`/w/${slug}/scheduled/${id}`, 'DELETE');
    setItems((current) => (current ?? []).filter((item) => item.id !== id));
  };

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={items ? <Text style={styles.empty}>Messages you schedule show up here.</Text> : undefined}
      ListFooterComponent={
        <>
          {reminders.length > 0 && <Text style={styles.section}>Reminders</Text>}
          {reminders.map((reminder) => (
            <View key={reminder.id} style={styles.rowLine}>
              <View style={styles.grow}>
                <Text style={styles.label}>{new Date(reminder.remind_at).toLocaleString()}</Text>
                <Text numberOfLines={2} style={styles.body}>{reminder.text}</Text>
              </View>
              <Button label="Cancel" onPress={() => cancelReminder(reminder.id)} />
            </View>
          ))}
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.rowLine}>
          <View style={styles.grow}>
            <Text style={styles.label}>
              {item.channel_label} · {item.failed ? 'Could not be sent' : new Date(item.send_at).toLocaleString()}
            </Text>
            <Text numberOfLines={2} style={styles.body}>{item.body}</Text>
          </View>
          <Button label="Cancel" onPress={() => cancel(item.id)} />
        </View>
      )}
      style={styles.screen}
    />
  );
}

export function ThreadsScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Threads'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug } = route.params;
  const [items, setItems] = useState<(Message & { channel_label: string })[] | null>(null);

  useEffect(() => {
    api<(Message & { channel_label: string })[]>(`/w/${slug}/threads`).then(setItems).catch(() => setItems([]));
  }, [slug]);

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={items ? <Text style={styles.empty}>Threads you join show up here.</Text> : undefined}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigation.navigate('Chat', { slug, channelId: item.channel_id, title: item.channel_label, parentId: item.id })
          }
          style={styles.row}
        >
          <Text style={styles.label}>
            {item.channel_label} · {item.reply_count} {item.reply_count === 1 ? 'reply' : 'replies'}
          </Text>
          <Text style={styles.title}>{item.user.name}</Text>
          <Text numberOfLines={2} style={styles.body}>{item.removed ? 'This message was deleted.' : item.body}</Text>
        </Pressable>
      )}
      style={styles.screen}
    />
  );
}

interface FileItem {
  id: number;
  name: string;
  url: string;
  sender: string;
  channel_label: string;
}

export function FilesScreen({ route }: NativeStackScreenProps<RootStack, 'Files'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug } = route.params;
  const [items, setItems] = useState<FileItem[] | null>(null);

  useEffect(() => {
    api<FileItem[]>(`/w/${slug}/files`).then(setItems).catch(() => setItems([]));
  }, [slug]);

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={items ? <Text style={styles.empty}>Files shared in your channels show up here.</Text> : undefined}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(fileSource(item.url).uri)} style={styles.row}>
          <View style={styles.fileRow}>
            <Ionicons name="document-outline" size={17} color={colors.textSecondary} />
            <Text style={styles.title}>{item.name}</Text>
          </View>
          <Text style={styles.label}>{item.sender} · {item.channel_label}</Text>
        </Pressable>
      )}
      style={styles.screen}
    />
  );
}

const PAUSES: [number, string][] = [[30, '30 min'], [60, '1 hour'], [480, '8 hours'], [0, 'Resume']];

export function ProfileScreen({ onSignOut }: { onSignOut: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const session = getSession();
  const [emoji, setEmoji] = useState('');
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [me, setMe] = useState<User | null>(session?.user ?? null);

  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      setNote(done);
    } catch (e) {
      setNote(errorText(e));
    }
  };

  const changePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    const asset = result.assets?.[0];

    if (result.canceled || !asset) return;

    const form = new FormData();
    form.append('photo', (asset.file ?? { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' }) as unknown as Blob);

    await run(async () => {
      await api('/me/avatar', 'POST', form);
      setMe(await api<User>('/me'));
    }, 'Photo updated.');
  };

  return (
    <ScrollView contentContainerStyle={styles.padded} keyboardShouldPersistTaps="handled" style={styles.screen}>
      {me && (
        <View style={styles.profileHead}>
          <Avatar user={me} size={64} />
          <View style={styles.grow}>
            <Text style={styles.title}>{me.name}</Text>
            <Text style={styles.label}>{me.email}</Text>
          </View>
        </View>
      )}
      <Button label="Change photo" onPress={changePhoto} />

      <Text style={styles.section}>Status</Text>
      <View style={styles.statusRow}>
        <TextInput accessibilityLabel="Status emoji" maxLength={4} onChangeText={setEmoji} placeholder="🌴" style={[styles.input, styles.emojiInput]} value={emoji} />
        <TextInput accessibilityLabel="Status text" maxLength={100} onChangeText={setText} placeholder="What's your status?" style={[styles.input, styles.grow]} value={text} />
      </View>
      <Button
        label="Save status"
        onPress={() => run(() => api('/me/status', 'PATCH', { status_emoji: emoji || null, status_text: text || null }), 'Status saved.')}
      />

      <Text style={styles.section}>Pause notifications</Text>
      <View style={styles.wrapRow}>
        {PAUSES.map(([minutes, label]) => (
          <Button
            key={minutes}
            label={label}
            onPress={() => run(() => api('/me/pause', 'POST', { minutes }), minutes ? `Paused for ${label}.` : 'Notifications resumed.')}
          />
        ))}
      </View>

      <Text style={styles.section}>Availability</Text>
      <Button label="Switch active / away" onPress={() => run(() => api('/me/away', 'POST'), 'Availability changed.')} />

      {note && <Text style={styles.note}>{note}</Text>}

      <View style={styles.signOut}>
        <Button danger label="Sign out" onPress={onSignOut} />
      </View>
    </ScrollView>
  );
}

export function ChannelInfoScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'ChannelInfo'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug, channelId, title } = route.params;
  const base = `/w/${slug}/c/${channelId}`;
  const [pins, setPins] = useState<Message[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState('');

  const moveTo = async (sectionId: number | null) => {
    await api(`${base}/section`, 'POST', { section_id: sectionId });
    setNote('Moved. It shows on the home screen.');
  };

  const addSection = async () => {
    if (!sectionName.trim()) return;

    const { id } = await api<{ id: number }>(`/w/${slug}/sections`, 'POST', { name: sectionName.trim() });
    setSectionName('');
    await moveTo(id);
  };

  useEffect(() => {
    api<Message[]>(`${base}/pins`).then(setPins).catch(() => {});
  }, [base]);

  const leave = async () => {
    try {
      await api(`${base}/leave`, 'POST');
      navigation.navigate('Home', { slug });
    } catch (e) {
      setNote(errorText(e));
    }
  };

  const mute = async () => {
    await api(`${base}/mute`, 'POST');
    setNote('Mute setting changed.');
  };

  return (
    <ScrollView contentContainerStyle={styles.padded} keyboardShouldPersistTaps="handled" style={styles.screen}>
      <Button label="Open canvas" onPress={() => navigation.navigate('Canvas', { slug, channelId, title })} />
      <Button label="Mute or unmute" onPress={mute} />
      {title.startsWith('#') && (
        <>
          <Text style={styles.section}>Sidebar section</Text>
          <View style={styles.wrapRow}>
            <Button label="Channels" onPress={() => moveTo(null)} />
            {getExtras().sections.map((section) => (
              <Button key={section.id} label={section.name} onPress={() => moveTo(section.id)} />
            ))}
          </View>
          <View style={styles.statusRow}>
            <TextInput accessibilityLabel="New section name" maxLength={40} onChangeText={setSectionName} placeholder="New section" style={[styles.input, styles.grow]} value={sectionName} />
            <Button label="Add" onPress={addSection} />
          </View>
        </>
      )}
      {title.startsWith('#') && <Button danger label="Leave channel" onPress={leave} />}
      {note && <Text style={styles.note}>{note}</Text>}

      <Text style={styles.section}>Pinned messages</Text>
      {pins.length === 0 && <Text style={styles.label}>Nothing is pinned yet.</Text>}
      {pins.map((pin) => (
        <View key={pin.id} style={styles.pin}>
          <Text style={styles.title}>{pin.user.name}</Text>
          <RichText text={pin.body || pin.cards[0]?.title || ''} />
        </View>
      ))}
    </ScrollView>
  );
}

interface CanvasData {
  body: string;
  version: number;
}

export function CanvasScreen({ route }: NativeStackScreenProps<RootStack, 'Canvas'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug, channelId } = route.params;
  const url = `/w/${slug}/c/${channelId}/canvas`;
  const [canvas, setCanvas] = useState<CanvasData | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<CanvasData>(url).then(setCanvas).catch((e) => setError(errorText(e)));
  }, [url]);

  const save = async () => {
    if (!canvas || draft === null) return;

    setError(null);
    try {
      setCanvas(await api<CanvasData>(url, 'PUT', { body: draft, version: canvas.version }));
      setDraft(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.padded} keyboardShouldPersistTaps="handled" style={styles.screen}>
      {error && <Text style={styles.error}>{error}</Text>}
      {!canvas ? (
        !error && <Text style={styles.label}>Loading…</Text>
      ) : draft === null ? (
        <>
          {canvas.body ? <RichText text={canvas.body} /> : <Text style={styles.label}>This canvas is empty.</Text>}
          <Button label="Edit" onPress={() => setDraft(canvas.body)} />
        </>
      ) : (
        <>
          <TextInput accessibilityLabel="Canvas text" multiline onChangeText={setDraft} style={[styles.input, styles.canvas]} value={draft} />
          <Button label="Save" onPress={save} />
        </>
      )}
    </ScrollView>
  );
}

export function ForwardScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Forward'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug, channelId, messageId } = route.params;
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ channels: Channel[]; members: User[] }>(`/w/${slug}`)
      .then((data) => {
        setChannels(data.channels);
        setMembers(data.members);
      })
      .catch((e) => setError(errorText(e)));
  }, [slug]);

  const label = (channel: Channel) =>
    channel.type === 'dm' ? (members.find((m) => m.id === channel.dm_user_id)?.name ?? 'Direct message') : `#${channel.name}`;

  const forward = async (target: Channel) => {
    try {
      await api(`/w/${slug}/c/${channelId}/messages/${messageId}/forward`, 'POST', { channel_id: target.id });
      navigation.goBack();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <View style={styles.screen}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={channels}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => forward(item)} style={styles.row}>
            <Text style={styles.title}>{label(item)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { backgroundColor: colors.dark, flex: 1 },
    padded: { gap: 10, padding: 16 },
    row: { borderBottomColor: colors.line, borderBottomWidth: 1, padding: 14 },
    rowLine: {
      alignItems: 'center',
      borderBottomColor: colors.line,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 14,
    },
    grow: { flex: 1, minWidth: 0 },
    label: { color: colors.textSecondary, fontSize: 13 },
    title: { color: colors.text, fontSize: 16, fontWeight: '700' },
    body: { color: colors.text, fontSize: 15 },
    fileRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    input: {
      backgroundColor: colors.inputBg,
      borderColor: colors.line,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      padding: 10,
    },
    button: { alignItems: 'center', backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
    dangerButton: { backgroundColor: colors.danger },
    buttonText: { color: '#ffffff', fontWeight: '700' },
    switchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    error: { color: colors.danger, padding: 8 },
    empty: { color: colors.muted, padding: 24, textAlign: 'center' },
    section: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 12 },
    profileHead: { alignItems: 'center', flexDirection: 'row', gap: 12 },
    statusRow: { flexDirection: 'row', gap: 8 },
    emojiInput: { textAlign: 'center', width: 56 },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    note: { color: colors.accent, marginTop: 8 },
    signOut: { marginTop: 24 },
    pin: { borderLeftColor: colors.accent, borderLeftWidth: 3, paddingLeft: 10 },
    canvas: { minHeight: 240, textAlignVertical: 'top' },
  });
