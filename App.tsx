import {
  createNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { maybeCompleteAuthSession } from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { loadSession, logout, Session, getLastWorkspace, saveLastWorkspace } from './src/api';
import { RootStack } from './src/navigation';
import { onNotificationOpened, registerForNotifications } from './src/notifications';
import { connect, disconnect } from './src/realtime';
import ChatScreen from './src/screens/ChatScreen';
import MainTabs from './src/screens/MainTabs';
import HuddleScreen from './src/screens/HuddleScreen';
import { ActivityScreen, SearchScreen, WorkspacesScreen } from './src/screens/ListScreens';
import LoginScreen from './src/screens/LoginScreen';
import {
  BrowseScreen,
  CanvasScreen,
  ChannelInfoScreen,
  DraftsScreen,
  FilesScreen,
  ForwardScreen,
  NewChannelScreen,
  ProfileScreen,
  SavedScreen,
  ScheduledScreen,
  ThreadsScreen,
} from './src/screens/MoreScreens';
import PreferencesScreen from './src/screens/PreferencesScreen';
import ColorModeScreen from './src/screens/ColorModeScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import NewMessageScreen from './src/screens/NewMessageScreen';
import CreateChannelScreen from './src/screens/CreateChannelScreen';
import ImageViewerScreen from './src/screens/ImageViewerScreen';
import ShareFileScreen from './src/screens/ShareFileScreen';
import { colors, ThemeProvider, useTheme } from './src/ui';

// On the web, the sign-in window hands its result back to the page that opened it.
maybeCompleteAuthSession();

const Stack = createNativeStackNavigator<RootStack>();
const navigation = createNavigationContainerRef<RootStack>();

function AppContent() {
  const { colors: themeColors, isDark } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [initialRoute, setInitialRoute] = useState<{ name: 'Workspaces' | 'Home'; params?: { slug: string } } | null>(null);

  // Without this, React Navigation falls back to its own palette -- an iOS blue
  // and a grey window -- which has nothing to do with the chosen colour mode.
  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;

    return {
      ...base,
      colors: {
        ...base.colors,
        primary: themeColors.accent,
        background: themeColors.dark,
        card: themeColors.dark,
        text: themeColors.text,
        border: themeColors.line,
        notification: themeColors.danger,
      },
    };
  }, [isDark, themeColors]);
  const [ready, setReady] = useState(false);
  // Expo Go does not run config plugins, so the icon font is registered here instead.
  const [fontsLoaded] = useFonts({ Ionicons: require('@react-native-vector-icons/ionicons/fonts/Ionicons.ttf') });

  const start = async (current: Session | null) => {
    if (current) {
      await connect().catch(() => null);
      registerForNotifications();

      // Check for last workspace and set initial route
      const lastWorkspace = await getLastWorkspace();
      if (lastWorkspace) {
        setInitialRoute({ name: 'Home', params: { slug: lastWorkspace } });
      } else {
        setInitialRoute({ name: 'Workspaces' });
      }
    } else {
      setInitialRoute({ name: 'Workspaces' });
    }
    setSession(current);
    setReady(true);
  };

  useEffect(() => {
    loadSession().then(start);

    return onNotificationOpened(({ slug, channel_id, thread }) => {
      if (navigation.isReady()) {
        navigation.navigate('Chat', { slug, channelId: channel_id, title: 'Conversation', parentId: thread ?? undefined });
      }
    });
  }, []);

  const signOut = async () => {
    disconnect();
    await logout();
    setInitialRoute({ name: 'Workspaces' });
    setSession(null);
  };

  if (!ready || !fontsLoaded || !initialRoute) {
    return (
      <View style={{ alignItems: 'center', backgroundColor: themeColors.dark, flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LoginScreen onSignedIn={start} />
      </>
    );
  }

  return (
    <NavigationContainer ref={navigation} theme={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName={initialRoute.name}
        screenOptions={{
          headerStyle: { backgroundColor: themeColors.dark },
          headerTintColor: themeColors.text,
        }}
      >
        <Stack.Screen name="Workspaces" options={{ title: 'Your workspaces' }}>
          {(props) => <WorkspacesScreen {...props} onSignOut={signOut} />}
        </Stack.Screen>
        <Stack.Screen
          component={MainTabs}
          name="Home"
          options={{ headerShown: false }}
          initialParams={initialRoute.name === 'Home' ? initialRoute.params : undefined}
        />
        <Stack.Screen component={ChatScreen} name="Chat" />
        <Stack.Screen component={ActivityScreen} name="Activity" />
        <Stack.Screen component={SearchScreen} name="Search" options={{ title: 'Search' }} />
        <Stack.Screen component={BrowseScreen} name="Browse" options={{ title: 'Browse channels' }} />
        <Stack.Screen component={NewChannelScreen} name="NewChannel" options={{ title: 'New channel' }} />
        <Stack.Screen component={NewMessageScreen} name="NewMessage" options={{ headerShown: false }} />
        <Stack.Screen component={CreateChannelScreen} name="CreateChannel" options={{ headerShown: false }} />
        <Stack.Screen component={SavedScreen} name="Saved" options={{ title: 'Saved items' }} />
        <Stack.Screen component={FilesScreen} name="Files" />
        <Stack.Screen component={HuddleScreen} name="Huddle" options={{ title: 'Huddle' }} />
        <Stack.Screen component={DraftsScreen} name="Drafts" />
        <Stack.Screen component={ScheduledScreen} name="Scheduled" />
        <Stack.Screen component={ThreadsScreen} name="Threads" />
        <Stack.Screen name="Profile">{() => <ProfileScreen onSignOut={signOut} />}</Stack.Screen>
        <Stack.Screen component={PreferencesScreen} name="Preferences" options={{ title: 'Preferences' }} />
        <Stack.Screen component={ColorModeScreen} name="ColorMode" options={{ title: 'Color mode' }} />
        <Stack.Screen component={NotificationsScreen} name="Notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen component={ChannelInfoScreen} name="ChannelInfo" options={{ title: 'Details' }} />
        <Stack.Screen component={CanvasScreen} name="Canvas" />
        <Stack.Screen component={ForwardScreen} name="Forward" options={{ title: 'Forward to' }} />
        <Stack.Screen
          component={ImageViewerScreen}
          name="ImageViewer"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          component={ShareFileScreen}
          name="ShareFile"
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
