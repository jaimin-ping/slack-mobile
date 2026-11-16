import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { fileSource, User } from './api';
import { getExtras, mentionNames } from './workspaceData';

export const colors = {
  brand: '#0f766e',
  dark: '#10302e',
  text: '#1e293b',
  muted: '#64748b',
  line: '#e2e8f0',
  soft: '#f1f5f9',
  danger: '#be123c',
  accent: '#fbbf24',
};

const AVATAR_COLORS = ['#0d9488', '#d97706', '#0284c7', '#e11d48', '#7c3aed', '#4d7c0f'];

export function Avatar({ user, size = 36 }: { user: User; size?: number }) {
  const box = { width: size, height: size, borderRadius: size / 4 };

  if (user.avatar_url) {
    return <Image source={fileSource(user.avatar_url)} style={box} />;
  }

  return (
    <View style={[box, styles.avatar, { backgroundColor: AVATAR_COLORS[user.id % AVATAR_COLORS.length] }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.45 }]}>{user.name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const INLINE =
  /(?<![\w*])\*([^*\n]+)\*(?![\w*])|(?<![\w_])__([^_\n]+)__(?![\w_])|(?<![\w_])_([^_\n]+)_(?![\w_])|(?<![\w~])~([^~\n]+)~(?![\w~])|`([^`\n]+)`|(https?:\/\/[^\s<>]+)/g;

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Highlights @mentions and swaps :name: for the workspace's custom emoji. */
function decorate(text: string, key: string): React.ReactNode[] {
  const names = mentionNames().sort((a, b) => b.length - a.length).map(escapeRegex);
  const emojis = new Map(getExtras().emojis.map((emoji) => [emoji.name, emoji.url]));
  const pattern = new RegExp(`((?<![\\w@])@(?:${names.join('|')})(?!\\w)|:[a-z0-9_-]{2,32}:)`, 'g');

  return text.split(pattern).map((part, index) => {
    const id = `${key}-d${index}`;
    const url = part.startsWith(':') ? emojis.get(part.slice(1, -1)) : undefined;

    if (url) return <Image key={id} source={fileSource(url)} style={styles.customEmoji} />;
    if (part.startsWith('@') && index % 2 === 1) return <Text key={id} style={styles.mention}>{part}</Text>;

    return part;
  });
}

function inline(text: string, key = 'x'): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    const [whole, bold, underline, italic, strike, code, url] = match;
    const at = match.index;
    const id = `${key}-${at}`;

    parts.push(...decorate(text.slice(last, at), `${key}-${at}`));
    last = at + whole.length;

    if (bold) parts.push(<Text key={id} style={styles.bold}>{inline(bold, id)}</Text>);
    else if (underline) parts.push(<Text key={id} style={styles.underline}>{inline(underline, id)}</Text>);
    else if (italic) parts.push(<Text key={id} style={styles.italic}>{inline(italic, id)}</Text>);
    else if (strike) parts.push(<Text key={id} style={styles.strike}>{inline(strike, id)}</Text>);
    else if (code) parts.push(<Text key={id} style={styles.code}>{code}</Text>);
    else parts.push(<Text key={id} style={styles.link} onPress={() => Linking.openURL(url)}>{url}</Text>);
  }

  parts.push(...decorate(text.slice(last), `${key}-end`));

  return parts;
}

/** Shows the same text marks as the web app. Quote and list lines keep their plain markers. */
export function RichText({ text }: { text: string }) {
  return <Text style={styles.body}>{inline(text)}</Text>;
}

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  strike: { textDecorationLine: 'line-through' },
  code: { backgroundColor: colors.soft, color: colors.danger, fontFamily: 'monospace', fontSize: 13 },
  link: { color: '#0369a1' },
  mention: { backgroundColor: '#e0f2fe', color: '#075985' },
  customEmoji: { height: 20, width: 20 },
});
