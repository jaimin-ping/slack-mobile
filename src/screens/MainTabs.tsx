import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons, { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { saveLastWorkspace } from '../api';
import { RootStack } from '../navigation';
import { useTheme } from '../ui';
import { ThemeColors } from '../theme';
import HomeTab from './HomeTab';
import DMsTab from './DMsTab';
import ActivityTab from './ActivityTab';
import SearchTab from './SearchTab';
import MoreTab from './MoreTab';

export type MainTabsParamList = {
  HomeTab: undefined;
  DMsTab: undefined;
  ActivityTab: undefined;
  SearchTab: undefined;
  MoreTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

/** Slack fills the tab icon in when it is the active tab, and outlines it when it is not. */
const TAB_ICONS: Record<string, { active: IoniconsIconName; inactive: IoniconsIconName }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  DMs: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  Activity: { active: 'notifications', inactive: 'notifications-outline' },
  Search: { active: 'search', inactive: 'search-outline' },
  More: { active: 'menu', inactive: 'menu-outline' },
};

const TabIcon = ({ name, focused, color }: { name: string; focused: boolean; color: string }) => {
  const icon = TAB_ICONS[name] ?? TAB_ICONS.Home;

  return <Ionicons name={focused ? icon.active : icon.inactive} size={24} color={color} />;
};

export default function MainTabs({ route }: NativeStackScreenProps<RootStack, 'Home'>) {
  const { slug } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Save last workspace when entering
  useEffect(() => {
    saveLastWorkspace(slug);
  }, [slug]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name.replace('Tab', '')} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="HomeTab"
        options={{ tabBarLabel: 'Home' }}
      >
        {(props) => <HomeTab {...props} slug={slug} />}
      </Tab.Screen>
      <Tab.Screen
        name="DMsTab"
        options={{ tabBarLabel: 'DMs' }}
      >
        {(props) => <DMsTab {...props} slug={slug} />}
      </Tab.Screen>
      <Tab.Screen
        name="ActivityTab"
        options={{ tabBarLabel: 'Activity' }}
      >
        {(props) => <ActivityTab {...props} slug={slug} />}
      </Tab.Screen>
      <Tab.Screen
        name="SearchTab"
        options={{ tabBarLabel: 'Search' }}
      >
        {(props) => <SearchTab {...props} slug={slug} />}
      </Tab.Screen>
      <Tab.Screen
        name="MoreTab"
        options={{ tabBarLabel: 'More' }}
      >
        {(props) => <MoreTab {...props} slug={slug} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: colors.dark,
      borderTopColor: colors.line,
      borderTopWidth: 1,
      paddingTop: 8,
      paddingBottom: 20,
      height: 72,
    },
    tabLabel: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
  });
