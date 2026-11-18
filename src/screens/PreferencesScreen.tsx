import Ionicons from '@react-native-vector-icons/ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { RootStack } from '../navigation';
import { useTheme } from '../ui';
import { ThemeColors } from '../theme';

export default function PreferencesScreen({ navigation }: NativeStackScreenProps<RootStack, 'Preferences'>) {
  const { colors, colorMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const colorModeLabel = {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    trueDark: 'True dark',
  }[colorMode];

  return (
    <ScrollView style={styles.screen}>
      {/* Notifications Section */}
      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.section}>
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('Notifications')}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Notifications</Text>
            <Text style={styles.rowSubtitle}>Customize your push notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>VIP</Text>
            <Text style={styles.rowSubtitle}>Manage your VIPs</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {/* Appearance Section */}
      <Text style={styles.sectionTitle}>Appearance</Text>
      <View style={styles.section}>
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('ColorMode')}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="color-palette-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Color mode</Text>
            <Text style={styles.rowSubtitle}>{colorModeLabel}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="hand-left-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Default emoji skin tone</Text>
            <Text style={styles.rowSubtitle}>hand</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Message display</Text>
            <Text style={styles.rowSubtitle}>Modify image & typing display</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="link-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Underline links</Text>
            <Text style={styles.rowSubtitle}>Websites and hyperlinks will be underlined in conversations</Text>
          </View>
          <Switch
            value={false}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Accessibility Section */}
      <Text style={styles.sectionTitle}>Accessibility</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Allow animated images & emoji</Text>
            <Text style={styles.rowSubtitle}>This only affects what you see</Text>
          </View>
          <Switch
            value={true}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="megaphone-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Announce incoming calls</Text>
            <Text style={styles.rowSubtitle}>Read caller name aloud</Text>
          </View>
          <Switch
            value={false}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Advanced Section */}
      <Text style={styles.sectionTitle}>Advanced</Text>
      <View style={styles.section}>
        <Pressable style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="build-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Advanced settings</Text>
            <Text style={styles.rowSubtitle}>Developer options and debugging</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Help & feedback</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
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
      marginLeft: 60,
    },
  });
