import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { maybeCompleteAuthSession } from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { loadSession, logout, Session } from './src/api';
import { RootStack } from './src/navigation';
import { onNotificationOpened, registerForNotifications } from './src/notifications';
import { connect, disconnect } from './src/realtime';
import ChatScreen from './src/screens/ChatScreen';
import HomeScreen from './src/screens/HomeScreen';
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
import { colors } from './src/ui';

// On the web, the sign-in window hands its result back to the page that opened it.
maybeCompleteAuthSession();

const Stack = createNativeStackNavigator<RootStack>();
const navigation = createNavigationContainerRef<RootStack>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  const start = async (current: Session | null) => {
    if (current) {
      await connect().catch(() => null);
      registerForNotifications();
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
    setSession(null);
  };

  if (!ready) {
    return (
      <View style={{ alignItems: 'center', backgroundColor: colors.dark, flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onSignedIn={start} />
      </>
    );
  }

  return (
    <NavigationContainer ref={navigation}>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.dark },
          headerTintColor: '#fff',
        }}
      >
        <Stack.Screen name="Workspaces" options={{ title: 'Your workspaces' }}>
          {(props) => <WorkspacesScreen {...props} onSignOut={signOut} />}
        </Stack.Screen>
        <Stack.Screen component={HomeScreen} name="Home" />
        <Stack.Screen component={ChatScreen} name="Chat" />
        <Stack.Screen component={ActivityScreen} name="Activity" />
        <Stack.Screen component={SearchScreen} name="Search" options={{ title: 'Search' }} />
        <Stack.Screen component={BrowseScreen} name="Browse" options={{ title: 'Browse channels' }} />
        <Stack.Screen component={NewChannelScreen} name="NewChannel" options={{ title: 'New channel' }} />
        <Stack.Screen component={SavedScreen} name="Saved" options={{ title: 'Saved items' }} />
        <Stack.Screen component={FilesScreen} name="Files" />
        <Stack.Screen component={HuddleScreen} name="Huddle" options={{ title: 'Huddle' }} />
        <Stack.Screen component={DraftsScreen} name="Drafts" />
        <Stack.Screen component={ScheduledScreen} name="Scheduled" />
        <Stack.Screen component={ThreadsScreen} name="Threads" />
        <Stack.Screen name="Profile">{() => <ProfileScreen onSignOut={signOut} />}</Stack.Screen>
        <Stack.Screen component={ChannelInfoScreen} name="ChannelInfo" options={{ title: 'Details' }} />
        <Stack.Screen component={CanvasScreen} name="Canvas" />
        <Stack.Screen component={ForwardScreen} name="Forward" options={{ title: 'Forward to' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
