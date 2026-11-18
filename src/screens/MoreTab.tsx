import WorkspaceHeader from '../WorkspaceHeader';
import Ionicons, { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSession } from '../api';
import { RootStack } from '../navigation';
import { Avatar, useTheme } from '../ui';
import { ThemeColors } from '../theme';

export default function MoreTab({ slug }: { slug: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const me = getSession()?.user;

  const styles = useMemo(() => createStyles(colors), [colors]);

  const menuItems: { icon: IoniconsIconName; label: string; screen: string }[] = [
    { icon: 'chatbubbles-outline', label: 'Threads', screen: 'Threads' },
    { icon: 'download-outline', label: 'Catch up', screen: 'Activity' },
    { icon: 'bookmark-outline', label: 'Saved items', screen: 'Saved' },
    { icon: 'folder-outline', label: 'Files', screen: 'Files' },
    { icon: 'create-outline', label: 'Drafts', screen: 'Drafts' },
    { icon: 'time-outline', label: 'Scheduled', screen: 'Scheduled' },
    { icon: 'grid-outline', label: 'Browse channels', screen: 'Browse' },
  ];

  return (
    <View style={styles.container}>
      <WorkspaceHeader style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>More</Text>
      </WorkspaceHeader>

      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <Pressable
          style={styles.profileSection}
          onPress={() => navigation.navigate('Profile')}
        >
          {me && <Avatar user={me} size={56} />}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{me?.name || 'User'}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: colors.online }]} />
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <View style={styles.divider} />

        {/* Menu Items */}
        {menuItems.map((item, index) => (
          <Pressable
            key={index}
            style={styles.menuRow}
            onPress={() => navigation.navigate(item.screen as any, { slug })}
          >
            <Ionicons name={item.icon} size={22} color={colors.textSecondary} style={styles.menuIcon} />
            <Text style={styles.menuLabel}>{item.label}</Text>
          </Pressable>
        ))}

        <View style={styles.divider} />

        {/* Settings Section */}
        <Pressable
          style={styles.menuRow}
          onPress={() => navigation.navigate('Preferences')}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} style={styles.menuIcon} />
          <Text style={styles.menuLabel}>Preferences</Text>
        </Pressable>

        <Pressable style={styles.menuRow}>
          <Ionicons name="help-circle-outline" size={22} color={colors.textSecondary} style={styles.menuIcon} />
          <Text style={styles.menuLabel}>Help & feedback</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* Workspace Section */}
        <Pressable
          style={styles.menuRow}
          onPress={() => navigation.navigate('Workspaces')}
        >
          <Ionicons name="business-outline" size={22} color={colors.textSecondary} style={styles.menuIcon} />
          <Text style={styles.menuLabel}>Switch workspace</Text>
        </Pressable>

        <View style={{ height: 100 }} />
      </ScrollView>
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
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    title: {
      color: colors.textBright,
      fontSize: 20,
      fontWeight: '700',
    },
    content: {
      flex: 1,
    },
    profileSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 14,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusText: {
      color: colors.muted,
      fontSize: 14,
    },
    divider: {
      height: 1,
      backgroundColor: colors.line,
      marginVertical: 8,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 14,
    },
    menuIcon: {
      width: 32,
      textAlign: 'center',
    },
    menuLabel: {
      color: colors.text,
      fontSize: 16,
    },
  });
