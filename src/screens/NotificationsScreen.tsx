import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { RootStack } from '../navigation';
import { useTheme } from '../ui';
import { ThemeColors } from '../theme';

type NotifyOption = 'all' | 'mentions' | 'nothing';

export default function NotificationsScreen({ navigation }: NativeStackScreenProps<RootStack, 'Notifications'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [notifyAbout, setNotifyAbout] = useState<NotifyOption>('all');
  const [sound, setSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const [inAppSound, setInAppSound] = useState(true);
  const [threadReplies, setThreadReplies] = useState(true);

  const notifyOptions: { value: NotifyOption; label: string; description: string }[] = [
    { value: 'all', label: 'All new messages', description: 'Get notified for every message' },
    { value: 'mentions', label: 'Direct messages & mentions', description: 'Only when someone mentions you or DMs you' },
    { value: 'nothing', label: 'Nothing', description: 'Turn off all notifications' },
  ];

  return (
    <ScrollView style={styles.screen}>
      {/* Notify me about */}
      <Text style={styles.sectionTitle}>Notify me about</Text>
      <View style={styles.section}>
        {notifyOptions.map((option, index) => (
          <View key={option.value}>
            {index > 0 && <View style={styles.divider} />}
            <Pressable
              style={styles.row}
              onPress={() => setNotifyAbout(option.value)}
            >
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{option.label}</Text>
                <Text style={styles.rowSubtitle}>{option.description}</Text>
              </View>
              <View style={[styles.radio, notifyAbout === option.value && styles.radioSelected]}>
                {notifyAbout === option.value && <View style={styles.radioInner} />}
              </View>
            </Pressable>
          </View>
        ))}
      </View>

      {/* Sound & Vibration */}
      <Text style={styles.sectionTitle}>Sound & Vibration</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Sound</Text>
            <Text style={styles.rowSubtitle}>Play a sound for notifications</Text>
          </View>
          <Switch
            value={sound}
            onValueChange={setSound}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Vibrate</Text>
            <Text style={styles.rowSubtitle}>Vibrate for notifications</Text>
          </View>
          <Switch
            value={vibrate}
            onValueChange={setVibrate}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>In-app sounds</Text>
            <Text style={styles.rowSubtitle}>Play sounds while using the app</Text>
          </View>
          <Switch
            value={inAppSound}
            onValueChange={setInAppSound}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Thread notifications */}
      <Text style={styles.sectionTitle}>Threads</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Thread replies</Text>
            <Text style={styles.rowSubtitle}>Get notified about replies to threads you're following</Text>
          </View>
          <Switch
            value={threadReplies}
            onValueChange={setThreadReplies}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Schedule */}
      <Text style={styles.sectionTitle}>Notification Schedule</Text>
      <View style={styles.section}>
        <Pressable style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Set a notification schedule</Text>
            <Text style={styles.rowSubtitle}>Choose when to allow notifications</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors.dark,
      flex: 1,
    },
    sectionTitle: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 24,
      marginBottom: 8,
      marginHorizontal: 16,
      textTransform: 'uppercase',
    },
    section: {
      backgroundColor: colors.cardBg,
      borderRadius: 10,
      marginHorizontal: 16,
      overflow: 'hidden',
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowContent: {
      flex: 1,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 16,
    },
    rowSubtitle: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 2,
    },
    chevron: {
      color: colors.muted,
      fontSize: 20,
    },
    divider: {
      backgroundColor: colors.line,
      height: StyleSheet.hairlineWidth,
      marginLeft: 16,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: colors.accent,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.accent,
    },
  });
