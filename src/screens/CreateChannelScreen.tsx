import Ionicons from '@react-native-vector-icons/ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { RootStack } from '../navigation';
import { useTheme } from '../ui';
import { ThemeColors } from '../theme';

export default function CreateChannelScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStack, 'CreateChannel'>) {
  const { slug } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = name.trim().length > 0;

  const handleNext = async () => {
    if (!isValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      const channelName = name.trim().toLowerCase().replace(/\s+/g, '-');
      const { channel_id } = await api<{ channel_id: number }>(
        `/w/${slug}/channels`,
        'POST',
        { name: channelName }
      );

      navigation.replace('Chat', {
        slug,
        channelId: channel_id,
        title: `#${channelName}`,
      });
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  // Convert input to lowercase and replace spaces with hyphens
  const formatChannelName = (text: string) => {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Create a channel</Text>
        <Pressable
          style={[styles.nextButton, !isValid && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!isValid || loading}
        >
          <Text style={[styles.nextText, !isValid && styles.nextTextDisabled]}>
            {loading ? 'Creating...' : 'Next'}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Name Label */}
        <Text style={styles.label}>Name</Text>

        {/* Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.hashPrefix}>#</Text>
          <TextInput
            style={styles.input}
            placeholder="project-name"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={(text) => setName(formatChannelName(text))}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="git-network-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            Channels are where conversations happen around a topic. Use a name that's easy to find and understand.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    nextButton: {
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    nextButtonDisabled: {
      opacity: 0.5,
    },
    nextText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    nextTextDisabled: {
      color: colors.muted,
    },
    content: {
      padding: 16,
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      paddingBottom: 10,
    },
    hashPrefix: {
      fontSize: 18,
      color: colors.muted,
      marginRight: 8,
    },
    input: {
      flex: 1,
      fontSize: 18,
      color: colors.text,
    },
    error: {
      color: colors.danger,
      fontSize: 14,
      marginTop: 10,
    },
    infoBox: {
      flexDirection: 'row',
      backgroundColor: colors.cardBg,
      borderRadius: 10,
      padding: 14,
      marginTop: 24,
      gap: 12,
      alignItems: 'flex-start',
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
  });
