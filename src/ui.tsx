import { useEffect, useMemo, useState } from 'react';
import { Image, ImageStyle, Linking, Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { fileSource, getSession, User } from './api';
import { ThemeColors, useTheme } from './theme';
import { getExtras, mentionNames } from './workspaceData';

// Re-export theme utilities
export { useTheme, ThemeProvider, defaultColors, lightTheme, darkTheme, trueDarkTheme } from './theme';
export type { ThemeColors, ColorMode } from './theme';

// Legacy static colors (for backward compatibility during migration)
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

/** Image component that handles authentication for protected images */
export function AuthImage({
  path,
  style,
  placeholder,
  onLoad,
  onError,
}: {
  path: string;
  style?: ImageStyle;
  placeholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: (error: string) => void;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const blobUrlRef = { current: '' };

  useEffect(() => {
    let mounted = true;
    const session = getSession();

    console.log('AuthImage loading:', path, 'Platform:', Platform.OS);

    if (!session) {
      console.log('AuthImage: No session');
      setHasError(true);
      setLoading(false);
      return;
    }

    const url = `${session.server}/api/v1${path}`;
    console.log('AuthImage URL:', url);

    // On web, fetch with headers and convert to blob URL
    if (Platform.OS === 'web') {
      fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Accept': 'image/*',
        },
        credentials: 'omit', // Don't send cookies
      })
        .then((response) => {
          console.log('AuthImage response:', response.status, response.statusText);
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          return response.blob();
        })
        .then((blob) => {
          if (mounted) {
            const blobUrl = URL.createObjectURL(blob);
            blobUrlRef.current = blobUrl;
            console.log('AuthImage blob URL created:', blobUrl);
            setImageUri(blobUrl);
            setLoading(false);
            onLoad?.();
          }
        })
        .catch((err) => {
          if (mounted) {
            console.error('AuthImage error:', err.message, 'URL:', url);
            setHasError(true);
            setLoading(false);
            onError?.(err.message);
          }
        });

      return () => {
        mounted = false;
        // Cleanup blob URL
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
      };
    }

    // On mobile, use the standard approach with headers
    setImageUri(url);
    setLoading(false);
    return () => { mounted = false; };
  }, [path]);

  if (loading || hasError || !imageUri) {
    return <View style={style as ViewStyle}>{placeholder}</View>;
  }

  if (Platform.OS === 'web') {
    return (
      <Image
        source={{ uri: imageUri }}
        style={style}
        onLoad={onLoad}
        onError={() => {
          setHasError(true);
          onError?.('Image load failed');
        }}
      />
    );
  }

  // Mobile with headers
  const session = getSession();
  return (
    <Image
      source={{
        uri: imageUri,
        headers: { Authorization: `Bearer ${session?.token}` },
      }}
      style={style}
      onLoad={onLoad}
      onError={() => {
        setHasError(true);
        onError?.('Image load failed');
      }}
    />
  );
}

const INLINE =
  /(?<![\w*])\*([^*\n]+)\*(?![\w*])|(?<![\w_])__([^_\n]+)__(?![\w_])|(?<![\w_])_([^_\n]+)_(?![\w_])|(?<![\w~])~([^~\n]+)~(?![\w~])|`([^`\n]+)`|(https?:\/\/[^\s<>]+)/g;

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Highlights @mentions and swaps :name: for the workspace's custom emoji. */
function decorate(text: string, key: string, styles: RichStyles): React.ReactNode[] {
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

function inline(text: string, key: string, styles: RichStyles): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    const [whole, bold, underline, italic, strike, code, url] = match;
    const at = match.index;
    const id = `${key}-${at}`;

    parts.push(...decorate(text.slice(last, at), `${key}-${at}`, styles));
    last = at + whole.length;

    if (bold) parts.push(<Text key={id} style={styles.bold}>{inline(bold, id, styles)}</Text>);
    else if (underline) parts.push(<Text key={id} style={styles.underline}>{inline(underline, id, styles)}</Text>);
    else if (italic) parts.push(<Text key={id} style={styles.italic}>{inline(italic, id, styles)}</Text>);
    else if (strike) parts.push(<Text key={id} style={styles.strike}>{inline(strike, id, styles)}</Text>);
    else if (code) parts.push(<Text key={id} style={styles.code}>{code}</Text>);
    else parts.push(<Text key={id} style={styles.link} onPress={() => Linking.openURL(url)}>{url}</Text>);
  }

  parts.push(...decorate(text.slice(last), `${key}-end`, styles));

  return parts;
}

/** Shows the same text marks as the web app. Quote and list lines keep their plain markers. */
export function RichText({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createRichStyles(colors), [colors]);

  return <Text style={styles.body}>{inline(text, 'x', styles)}</Text>;
}

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontWeight: '700' },
});

type RichStyles = ReturnType<typeof createRichStyles>;

const createRichStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    body: { color: colors.text, fontSize: 15, lineHeight: 22 },
    bold: { fontWeight: '700' },
    italic: { fontStyle: 'italic' },
    underline: { textDecorationLine: 'underline' },
    strike: { textDecorationLine: 'line-through' },
    code: {
      backgroundColor: colors.soft,
      color: colors.danger,
      fontFamily: 'monospace',
      fontSize: 13,
    },
    link: { color: colors.accent },
    mention: { backgroundColor: colors.hoverBg, color: colors.accent, fontWeight: '600' },
    customEmoji: { height: 20, width: 20 },
  });
