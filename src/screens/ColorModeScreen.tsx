import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { RootStack } from '../navigation';
import { useTheme, ColorMode } from '../ui';
import { ThemeColors, lightTheme, darkTheme, trueDarkTheme } from '../theme';

interface ThemeOption {
  mode: ColorMode;
  label: string;
  description?: string;
  previewColors: {
    bg: string;
    sidebar: string;
    content: string;
    accent: string;
  };
}

const themeOptions: ThemeOption[] = [
  {
    mode: 'system',
    label: 'System',
    description: 'Uses device settings',
    previewColors: {
      bg: '#1a1d21',
      sidebar: '#3f0e40',
      content: '#d1d2d3',
      accent: '#e01e5a',
    },
  },
  {
    mode: 'light',
    label: 'Light',
    previewColors: {
      bg: lightTheme.dark,
      sidebar: lightTheme.sidebar,
      content: lightTheme.text,
      accent: lightTheme.danger,
    },
  },
  {
    mode: 'dark',
    label: 'Dark',
    previewColors: {
      bg: darkTheme.dark,
      sidebar: darkTheme.sidebar,
      content: darkTheme.text,
      accent: darkTheme.danger,
    },
  },
  {
    mode: 'trueDark',
    label: 'True dark 😎',
    previewColors: {
      bg: trueDarkTheme.dark,
      sidebar: trueDarkTheme.sidebar,
      content: trueDarkTheme.text,
      accent: trueDarkTheme.danger,
    },
  },
];

function ThemePreview({ option, isSelected }: { option: ThemeOption; isSelected: boolean }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        previewStyles.container,
        { backgroundColor: option.previewColors.bg, borderColor: isSelected ? colors.accent : colors.line },
        isSelected && previewStyles.selected,
      ]}
    >
      {/* Sidebar */}
      <View style={[previewStyles.sidebar, { backgroundColor: option.previewColors.sidebar }]}>
        <View style={[previewStyles.sidebarItem, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
        <View style={[previewStyles.sidebarItem, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
        <View style={[previewStyles.sidebarItem, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
      </View>

      {/* Content */}
      <View style={previewStyles.content}>
        {/* Header */}
        <View style={[previewStyles.header, { backgroundColor: option.previewColors.sidebar }]} />

        {/* Messages */}
        <View style={previewStyles.messages}>
          <View style={previewStyles.message}>
            <View style={[previewStyles.avatar, { backgroundColor: option.previewColors.accent }]} />
            <View style={previewStyles.messageLines}>
              <View style={[previewStyles.line, { backgroundColor: option.previewColors.content, width: '60%' }]} />
              <View style={[previewStyles.line, { backgroundColor: option.previewColors.content, width: '80%', opacity: 0.5 }]} />
            </View>
          </View>
          <View style={previewStyles.message}>
            <View style={[previewStyles.avatar, { backgroundColor: '#2eb67d' }]} />
            <View style={previewStyles.messageLines}>
              <View style={[previewStyles.line, { backgroundColor: option.previewColors.content, width: '50%' }]} />
              <View style={[previewStyles.line, { backgroundColor: option.previewColors.content, width: '70%', opacity: 0.5 }]} />
            </View>
          </View>
          <View style={previewStyles.message}>
            <View style={[previewStyles.avatar, { backgroundColor: '#ecb22e' }]} />
            <View style={previewStyles.messageLines}>
              <View style={[previewStyles.line, { backgroundColor: option.previewColors.content, width: '55%' }]} />
              <View style={[previewStyles.line, { backgroundColor: option.previewColors.content, width: '65%', opacity: 0.5 }]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  container: {
    width: 80,
    height: 56,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 2,
  },
  selected: {
    borderWidth: 2,
  },
  sidebar: {
    width: 20,
    padding: 4,
    gap: 3,
  },
  sidebarItem: {
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  header: {
    height: 10,
  },
  messages: {
    padding: 4,
    gap: 4,
  },
  message: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  avatar: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  messageLines: {
    flex: 1,
    gap: 2,
  },
  line: {
    height: 3,
    borderRadius: 1,
  },
});

export default function ColorModeScreen({ navigation }: NativeStackScreenProps<RootStack, 'ColorMode'>) {
  const { colors, colorMode, setColorMode, increaseContrast, setIncreaseContrast } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.section}>
        {themeOptions.map((option, index) => (
          <View key={option.mode}>
            {index > 0 && <View style={styles.divider} />}
            <Pressable
              style={styles.row}
              onPress={() => setColorMode(option.mode)}
            >
              <ThemePreview option={option} isSelected={colorMode === option.mode} />
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{option.label}</Text>
                {option.description && (
                  <Text style={styles.rowSubtitle}>{option.description}</Text>
                )}
              </View>
              <View style={[styles.radio, colorMode === option.mode && styles.radioSelected]}>
                {colorMode === option.mode && <View style={styles.radioInner} />}
              </View>
            </Pressable>
          </View>
        ))}
      </View>

      {/* Contrast option */}
      <View style={[styles.section, { marginTop: 24 }]}>
        <View style={styles.row}>
          <View style={styles.checkboxContainer}>
            <Pressable
              style={[styles.checkbox, increaseContrast && styles.checkboxChecked]}
              onPress={() => setIncreaseContrast(!increaseContrast)}
            >
              {increaseContrast && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Increase contrast</Text>
          </View>
          <Switch
            value={increaseContrast}
            onValueChange={setIncreaseContrast}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <Text style={styles.hint}>
        Choose how Ping Chat appears to you. Select a single theme, or sync with your system settings.
      </Text>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors.dark,
      flex: 1,
      padding: 16,
    },
    section: {
      backgroundColor: colors.cardBg,
      borderRadius: 10,
      overflow: 'hidden',
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 14,
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
    divider: {
      backgroundColor: colors.line,
      height: StyleSheet.hairlineWidth,
      marginLeft: 110,
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
    checkboxContainer: {
      width: 80,
      alignItems: 'center',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    checkmark: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    hint: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 16,
      lineHeight: 18,
      paddingHorizontal: 4,
    },
  });
