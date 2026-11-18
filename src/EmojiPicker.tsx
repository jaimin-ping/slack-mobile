import { useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import emojiData from 'unicode-emoji-json/data-by-emoji.json';
import { fileSource } from './api';
import { useTheme } from './ui';
import { ThemeColors } from './theme';
import { getExtras } from './workspaceData';

interface Item {
  key: string;
  emoji?: string;
  name: string;
  url?: string;
}

const ALL: Item[] = Object.entries(emojiData as Record<string, { name: string }>).map(([emoji, data]) => ({
  key: emoji,
  emoji,
  name: data.name,
}));

const MAX_SHOWN = 240;

/** Reactions accept standard emoji only, so custom ones appear just for message text. */
export default function EmojiPicker({
  onPick,
  onClose,
  allowCustom = false,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
  allowCustom?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [term, setTerm] = useState('');

  const items = useMemo(() => {
    const custom: Item[] = allowCustom
      ? getExtras().emojis.map((emoji) => ({ key: `c${emoji.id}`, name: emoji.name, url: emoji.url }))
      : [];
    const search = term.trim().toLowerCase();

    return [...custom, ...ALL].filter((item) => item.name.includes(search)).slice(0, MAX_SHOWN);
  }, [term, allowCustom]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable style={styles.sheet}>
          <TextInput
            accessibilityLabel="Search emoji"
            autoCapitalize="none"
            onChangeText={setTerm}
            placeholder="Search emoji"
            style={styles.search}
            value={term}
          />
          <FlatList
            data={items}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.key}
            ListEmptyComponent={<Text style={styles.empty}>No emoji found.</Text>}
            numColumns={8}
            renderItem={({ item }) => (
              <Pressable
                accessibilityLabel={item.name}
                onPress={() => onPick(item.emoji ?? `:${item.name}:`)}
                style={styles.cell}
              >
                {item.url ? <Image source={fileSource(item.url)} style={styles.image} /> : <Text style={styles.emoji}>{item.emoji}</Text>}
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { backgroundColor: 'rgba(0,0,0,0.45)', flex: 1, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.dark,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      height: '60%',
      padding: 12,
    },
    search: {
      backgroundColor: colors.inputBg,
      borderColor: colors.line,
      borderRadius: 10,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      marginBottom: 8,
      padding: 10,
    },
    cell: { alignItems: 'center', flex: 1, paddingVertical: 6 },
    emoji: { fontSize: 26 },
    image: { height: 28, width: 28 },
    empty: { color: colors.muted, padding: 20, textAlign: 'center' },
  });
