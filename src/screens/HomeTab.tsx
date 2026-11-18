import WorkspaceHeader from '../WorkspaceHeader';
import Ionicons, { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Channel, getSession, Message, User, Workspace, saveLastWorkspace } from '../api';
import { RootStack } from '../navigation';
import { listen } from '../realtime';
import { Avatar, useTheme } from '../ui';
import { ThemeColors } from '../theme';
import { Extras, setWorkspaceData } from '../workspaceData';

interface Bootstrap {
  workspace: Workspace;
  channels: Channel[];
  members: User[];
  extras: Extras;
}

interface SectionState {
  [key: string]: boolean;
}

// Quick Access Card Component
function QuickAccessCard({
  icon,
  title,
  subtitle,
  onPress,
  colors,
}: {
  icon: IoniconsIconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      style={[styles.quickCard, { backgroundColor: colors.cardBg, borderColor: colors.line }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={19} color={colors.textSecondary} style={styles.quickCardIcon} />
      <Text style={[styles.quickCardTitle, { color: colors.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.quickCardSubtitle, { color: colors.muted }]}>{subtitle}</Text>
      )}
    </Pressable>
  );
}

// Collapsible Section Header
function SectionHeader({
  title,
  isExpanded,
  onToggle,
  onAdd,
  colors,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  colors: ThemeColors;
}) {
  return (
    <View style={[sectionStyles.header, { borderTopColor: colors.line }]}>
      <Pressable style={sectionStyles.headerLeft} onPress={onToggle}>
        <Text style={[sectionStyles.hashIcon, { color: colors.muted }]}>#</Text>
        <Text style={[sectionStyles.headerTitle, { color: colors.text }]}>{title}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.muted} style={sectionStyles.arrow} />
      </Pressable>
      <View style={sectionStyles.headerRight}>
        {onAdd && (
          <Pressable style={sectionStyles.headerBtn} onPress={onAdd}>
            <Ionicons name="add" size={22} color={colors.muted} />
          </Pressable>
        )}
        <Pressable style={sectionStyles.headerBtn} onPress={onToggle}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}

// Profile Menu Modal
function ProfileMenu({
  visible,
  onClose,
  user,
  colors,
  onPreferences,
}: {
  visible: boolean;
  onClose: () => void;
  user: User | undefined;
  colors: ThemeColors;
  onPreferences: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={menuStyles.backdrop} onPress={onClose}>
        <View style={[menuStyles.menu, { backgroundColor: colors.cardBg }]}>
          {/* User Info */}
          <View style={menuStyles.userSection}>
            {user && <Avatar user={user} size={48} />}
            <View style={menuStyles.userInfo}>
              <Text style={[menuStyles.userName, { color: colors.text }]}>
                {user?.name || 'User'}
              </Text>
              <View style={menuStyles.statusRow}>
                <View style={[menuStyles.statusDot, { backgroundColor: colors.online }]} />
                <Text style={[menuStyles.statusText, { color: colors.muted }]}>Active</Text>
              </View>
            </View>
          </View>

          <View style={[menuStyles.divider, { backgroundColor: colors.line }]} />

          {/* Menu Items */}
          <Pressable style={menuStyles.menuItem}>
            <Text style={menuStyles.menuIcon}>💻</Text>
            <Text style={[menuStyles.menuText, { color: colors.text }]}>Working</Text>
          </Pressable>

          <Pressable style={menuStyles.menuItem}>
            <Ionicons name="remove-circle-outline" size={20} color={colors.textSecondary} style={menuStyles.menuIcon} />
            <Text style={[menuStyles.menuText, { color: colors.text }]}>Set yourself as away</Text>
          </Pressable>

          <Pressable style={menuStyles.menuItem}>
            <Ionicons name="notifications-off-outline" size={20} color={colors.textSecondary} style={menuStyles.menuIcon} />
            <Text style={[menuStyles.menuText, { color: colors.text }]}>Pause notifications</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} style={menuStyles.menuArrow} />
          </Pressable>

          <View style={[menuStyles.divider, { backgroundColor: colors.line }]} />

          <Pressable
            style={menuStyles.menuItem}
            onPress={() => {
              onClose();
              onPreferences();
            }}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} style={menuStyles.menuIcon} />
            <Text style={[menuStyles.menuText, { color: colors.text }]}>Preferences</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function HomeTab({ slug }: { slug: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const me = getSession()?.user;

  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState<SectionState>({});
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const stops = useRef(new Map<number, () => void>());

  const dynamicStyles = useMemo(() => createDynamicStyles(colors), [colors]);

  const load = useCallback(async () => {
    try {
      const next = await api<Bootstrap>(`/w/${slug}`);
      setWorkspaceData(next.members, next.extras);
      setData(next);
      setError(null);

      // Initialize sections as expanded
      const initialSections: SectionState = { channels: true, dms: true };
      next.extras.sections.forEach((s) => {
        initialSections[`section-${s.id}`] = true;
      });
      setSections(initialSections);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  // Load all workspaces for switcher
  useEffect(() => {
    api<Workspace[]>('/workspaces')
      .then(setWorkspaces)
      .catch(() => {});
  }, []);

  // Real-time unread updates
  useEffect(() => {
    data?.channels.forEach(({ id }) => {
      if (stops.current.has(id)) return;

      stops.current.set(
        id,
        listen<Message>(`private-channel.${id}`, 'message.sent', (message) => {
          if (message.parent_id !== null || message.user.id === me?.id) return;

          setData((current) =>
            current && {
              ...current,
              channels: current.channels.map((c) =>
                c.id === id ? { ...c, unread: c.unread + 1 } : c
              ),
            }
          );
        })
      );
    });
  }, [data?.channels, me?.id]);

  useEffect(() => {
    const all = stops.current;
    return () => {
      all.forEach((stop) => stop());
      all.clear();
    };
  }, []);

  const toggleSection = (key: string) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openChannel = (channel: Channel, title: string, dmUser?: User) => {
    navigation.navigate('Chat', {
      slug,
      channelId: channel.id,
      title,
      channelType: channel.type,
      dmUser: dmUser ? {
        id: dmUser.id,
        name: dmUser.name,
        avatar_url: dmUser.avatar_url,
        status_emoji: dmUser.status_emoji,
      } : undefined,
    });
  };

  const openPerson = async (person: User) => {
    const existing = data?.channels.find((c) => c.dm_user_id === person.id);
    if (existing) {
      openChannel(existing, person.name, person);
      return;
    }
    const { channel_id } = await api<{ channel_id: number }>(`/w/${slug}/dm/${person.id}`, 'POST');
    navigation.navigate('Chat', {
      slug,
      channelId: channel_id,
      title: person.name,
      channelType: 'dm',
      dmUser: {
        id: person.id,
        name: person.name,
        avatar_url: person.avatar_url,
        status_emoji: person.status_emoji,
      },
    });
  };

  const namedChannels = data?.channels.filter((c) => c.type !== 'dm') ?? [];
  // Include current user in people list (for self-DM), put them first
  const otherPeople = data?.members.filter((m) => m.id !== me?.id) ?? [];
  const selfUser = data?.members.find((m) => m.id === me?.id);
  const people = selfUser ? [selfUser, ...otherPeople] : otherPeople;

  const renderChannel = (channel: Channel) => (
    <Pressable
      key={channel.id}
      style={dynamicStyles.channelRow}
      onPress={() => openChannel(channel, `#${channel.name}`)}
    >
      <Text style={dynamicStyles.channelIcon}>
        {channel.type === 'private' ? '🔒' : '#'}
      </Text>
      <Text
        style={[
          dynamicStyles.channelName,
          channel.unread > 0 && !channel.muted && dynamicStyles.unreadText,
          channel.muted && dynamicStyles.mutedText,
        ]}
      >
        {channel.name}
      </Text>
      {channel.unread > 0 && !channel.muted && (
        <View style={dynamicStyles.unreadBadge}>
          <Text style={dynamicStyles.unreadBadgeText}>{channel.unread}</Text>
        </View>
      )}
    </Pressable>
  );

  const renderPerson = (person: User) => {
    const dm = data?.channels.find((c) => c.dm_user_id === person.id);
    const isSelf = person.id === me?.id;
    return (
      <Pressable
        key={person.id}
        style={dynamicStyles.channelRow}
        onPress={() => openPerson(person)}
      >
        <Avatar user={person} size={24} />
        <Text
          style={[
            dynamicStyles.channelName,
            !!dm?.unread && dynamicStyles.unreadText,
          ]}
        >
          {person.name}{isSelf ? ' (you)' : ''}
        </Text>
        {person.status_emoji && <Text>{person.status_emoji}</Text>}
        {!!dm?.unread && (
          <View style={dynamicStyles.unreadBadge}>
            <Text style={dynamicStyles.unreadBadgeText}>{dm.unread}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <WorkspaceHeader style={[dynamicStyles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={dynamicStyles.headerLeft} onPress={() => setShowWorkspaceSwitcher(true)}>
          <View style={dynamicStyles.workspaceIcon}>
            <Text style={dynamicStyles.workspaceIconText}>
              {data?.workspace.name?.charAt(0) || 'P'}
            </Text>
          </View>
          <Text style={dynamicStyles.workspaceName} numberOfLines={1}>
            {data?.workspace.name || 'Ping Chat'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textBright} style={dynamicStyles.dropdownArrow} />
        </Pressable>
        <View style={dynamicStyles.headerRight}>
          <Pressable
            style={dynamicStyles.headerIcon}
            onPress={() => navigation.navigate('Search', { slug })}
          >
            <Ionicons name="search" size={22} color={colors.textBright} />
          </Pressable>
          <Pressable
            style={dynamicStyles.headerIcon}
            onPress={() => setShowProfileMenu(true)}
          >
            {me && <Avatar user={me} size={28} />}
            <View style={[dynamicStyles.statusIndicator, { backgroundColor: colors.online }]} />
          </Pressable>
        </View>
      </WorkspaceHeader>

      {/* Content */}
      <ScrollView
        style={dynamicStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.text}
          />
        }
      >
        {error && <Text style={dynamicStyles.error}>{error}</Text>}

        {/* Quick Access Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={dynamicStyles.quickCardsContainer}
          contentContainerStyle={dynamicStyles.quickCardsContent}
        >
          <QuickAccessCard
            icon="download-outline"
            title="Catch up"
            subtitle="1 new"
            onPress={() => navigation.navigate('Activity', { slug })}
            colors={colors}
          />
          <QuickAccessCard
            icon="sparkles-outline"
            title="Slackbot"
            subtitle="Ask anything"
            onPress={() => {}}
            colors={colors}
          />
          <QuickAccessCard
            icon="chatbubbles-outline"
            title="Threads"
            subtitle="Caught up"
            onPress={() => navigation.navigate('Threads', { slug })}
            colors={colors}
          />
          <QuickAccessCard
            icon="folder-outline"
            title="Files"
            subtitle=""
            onPress={() => navigation.navigate('Files', { slug })}
            colors={colors}
          />
        </ScrollView>

        {/* Custom Sections */}
        {data?.extras.sections.map((section) => (
          <View key={section.id}>
            <SectionHeader
              title={section.name}
              isExpanded={sections[`section-${section.id}`] ?? true}
              onToggle={() => toggleSection(`section-${section.id}`)}
              onAdd={() => navigation.navigate('NewChannel', { slug })}
              colors={colors}
            />
            {sections[`section-${section.id}`] &&
              namedChannels
                .filter((c) => c.section_id === section.id)
                .map(renderChannel)}
          </View>
        ))}

        {/* Channels Section */}
        <SectionHeader
          title="Channels"
          isExpanded={sections.channels ?? true}
          onToggle={() => toggleSection('channels')}
          onAdd={() => navigation.navigate('NewChannel', { slug })}
          colors={colors}
        />
        {sections.channels &&
          namedChannels.filter((c) => !c.section_id).map(renderChannel)}
        {sections.channels && (
          <Pressable
            style={dynamicStyles.addChannelRow}
            onPress={() => navigation.navigate('NewChannel', { slug })}
          >
            <Text style={dynamicStyles.addIcon}>+</Text>
            <Text style={dynamicStyles.addText}>Add channel</Text>
          </Pressable>
        )}

        {/* Direct Messages Section */}
        <SectionHeader
          title="Direct messages"
          isExpanded={sections.dms ?? true}
          onToggle={() => toggleSection('dms')}
          onAdd={() => navigation.navigate('NewMessage', { slug })}
          colors={colors}
        />
        {sections.dms && people.map(renderPerson)}
        {sections.dms && people.length === 0 && (
          <Pressable
            style={dynamicStyles.addChannelRow}
            onPress={() => navigation.navigate('NewMessage', { slug })}
          >
            <Text style={dynamicStyles.addIcon}>+</Text>
            <Text style={dynamicStyles.addText}>Start a conversation</Text>
          </Pressable>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={[dynamicStyles.fab, { backgroundColor: colors.brand }]}
        onPress={() => setShowFabMenu(true)}
      >
        <Text style={dynamicStyles.fabIcon}>+</Text>
      </Pressable>

      {/* FAB Menu Modal */}
      <Modal visible={showFabMenu} transparent animationType="fade" onRequestClose={() => setShowFabMenu(false)}>
        <Pressable style={fabMenuStyles.backdrop} onPress={() => setShowFabMenu(false)}>
          <View style={[fabMenuStyles.menu, { backgroundColor: colors.cardBg }]}>
            {/* Add to-do */}
            <Pressable
              style={fabMenuStyles.menuItem}
              onPress={() => {
                setShowFabMenu(false);
                // TODO: Navigate to Add to-do screen
              }}
            >
              <View style={[fabMenuStyles.iconContainer, { backgroundColor: colors.brand }]}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
              </View>
              <View style={fabMenuStyles.textContainer}>
                <Text style={[fabMenuStyles.menuTitle, { color: colors.text }]}>Add to-do</Text>
                <Text style={[fabMenuStyles.menuSubtitle, { color: colors.muted }]}>Create a task</Text>
              </View>
            </Pressable>

            {/* Channel */}
            <Pressable
              style={fabMenuStyles.menuItem}
              onPress={() => {
                setShowFabMenu(false);
                navigation.navigate('CreateChannel', { slug });
              }}
            >
              <View style={[fabMenuStyles.iconContainer, { backgroundColor: colors.brand }]}>
                <Text style={fabMenuStyles.hashIcon}>#</Text>
              </View>
              <View style={fabMenuStyles.textContainer}>
                <Text style={[fabMenuStyles.menuTitle, { color: colors.text }]}>Channel</Text>
                <Text style={[fabMenuStyles.menuSubtitle, { color: colors.muted }]}>Organize teams and work</Text>
              </View>
            </Pressable>

            {/* Message Button */}
            <Pressable
              style={[fabMenuStyles.messageButton, { backgroundColor: colors.brand }]}
              onPress={() => {
                setShowFabMenu(false);
                navigation.navigate('NewMessage', { slug });
              }}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={fabMenuStyles.messageButtonText}>Message</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Profile Menu */}
      <ProfileMenu
        visible={showProfileMenu}
        onClose={() => setShowProfileMenu(false)}
        user={me}
        colors={colors}
        onPreferences={() => navigation.navigate('Preferences')}
      />

      {/* Workspace Switcher Modal */}
      <Modal
        visible={showWorkspaceSwitcher}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWorkspaceSwitcher(false)}
      >
        <Pressable style={workspaceSwitcherStyles.backdrop} onPress={() => setShowWorkspaceSwitcher(false)}>
          <View style={[workspaceSwitcherStyles.menu, { backgroundColor: colors.cardBg }]}>
            <Text style={[workspaceSwitcherStyles.title, { color: colors.text }]}>Workspaces</Text>

            {workspaces.map((workspace) => (
              <Pressable
                key={workspace.id}
                style={[
                  workspaceSwitcherStyles.workspaceRow,
                  workspace.slug === slug && { backgroundColor: colors.soft },
                ]}
                onPress={async () => {
                  setShowWorkspaceSwitcher(false);
                  if (workspace.slug !== slug) {
                    await saveLastWorkspace(workspace.slug);
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Home', params: { slug: workspace.slug } }],
                    });
                  }
                }}
              >
                <View style={[workspaceSwitcherStyles.workspaceIcon, { backgroundColor: colors.brand }]}>
                  <Text style={workspaceSwitcherStyles.workspaceIconText}>
                    {workspace.name.charAt(0)}
                  </Text>
                </View>
                <Text style={[workspaceSwitcherStyles.workspaceName, { color: colors.text }]}>
                  {workspace.name}
                </Text>
                {workspace.slug === slug && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}

            <View style={[workspaceSwitcherStyles.divider, { backgroundColor: colors.line }]} />

            <Pressable
              style={workspaceSwitcherStyles.addRow}
              onPress={() => {
                setShowWorkspaceSwitcher(false);
                navigation.navigate('Workspaces');
              }}
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.textSecondary} />
              <Text style={[workspaceSwitcherStyles.addText, { color: colors.textSecondary }]}>
                Add a workspace
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  quickCard: {
    width: 108,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  quickCardIcon: {
    marginBottom: 5,
  },
  quickCardTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickCardSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
});

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hashIcon: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  arrow: {
    fontSize: 14,
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 4,
  },
  headerBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    fontSize: 18,
  },
});

const fabMenuStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingBottom: 100,
  },
  menu: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hashIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

const workspaceSwitcherStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 80,
  },
  menu: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 12,
  },
  workspaceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceIconText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  workspaceName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  addText: {
    fontSize: 16,
  },
});

const menuStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
  },
  menu: {
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
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
    fontSize: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuIcon: {
    width: 28,
  },
  menuText: {
    fontSize: 16,
    flex: 1,
  },
  menuArrow: {
  },
});

const createDynamicStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.dark,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    workspaceIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    workspaceIconText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
    },
    workspaceName: {
      color: colors.textBright,
      fontSize: 18,
      fontWeight: '700',
      maxWidth: 150,
    },
    dropdownArrow: {
      marginLeft: 6,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIcon: {
      position: 'relative',
    },
    headerIconText: {
      fontSize: 22,
    },
    statusIndicator: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.sidebar,
    },
    content: {
      flex: 1,
    },
    error: {
      color: colors.danger,
      padding: 16,
    },
    quickCardsContainer: {
      marginVertical: 10,
    },
    quickCardsContent: {
      paddingHorizontal: 16,
    },
    channelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
    },
    channelIcon: {
      fontSize: 16,
      width: 24,
      textAlign: 'center',
      color: colors.muted,
    },
    channelName: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    unreadText: {
      color: colors.text,
      fontWeight: '700',
    },
    mutedText: {
      opacity: 0.5,
    },
    unreadBadge: {
      backgroundColor: colors.danger,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    unreadBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    addChannelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
    },
    addIcon: {
      fontSize: 18,
      width: 24,
      textAlign: 'center',
      color: colors.muted,
    },
    addText: {
      fontSize: 16,
      color: colors.muted,
    },
    fab: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    fabIcon: {
      color: '#fff',
      fontSize: 28,
      fontWeight: '300',
    },
  });
