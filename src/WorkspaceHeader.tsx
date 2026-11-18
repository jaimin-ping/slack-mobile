import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { setStatusBarStyle } from 'expo-status-bar';
import { ReactNode, useCallback } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from './ui';

/**
 * The workspace bar at the top of every tab. Slack paints it with a diagonal
 * gradient rather than a flat colour, so the tabs share this one component.
 *
 * It reaches up behind the status bar, so while a tab is on screen the status
 * bar icons are forced light; pushed screens keep their own lighter header and
 * get the themed style back on blur.
 */
export default function WorkspaceHeader({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');

      return () => setStatusBarStyle(isDark ? 'light' : 'dark');
    }, [isDark]),
  );

  return (
    <LinearGradient
      colors={[colors.headerFrom, colors.headerTo]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
