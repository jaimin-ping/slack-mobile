import Ionicons from '@react-native-vector-icons/ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, fileSource } from '../api';
import { RootStack } from '../navigation';
import { useTheme } from '../ui';
import { ThemeColors } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageViewerScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStack, 'ImageViewer'>) {
  const { slug, fileId, fileUrl, fileName, userName, userAvatar, timestamp, sharedIn } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [showMenu, setShowMenu] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const imageUri = fileSource(fileUrl).uri;

  const handleShare = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        // Download file first then share
        const fileUri = FileSystem.cacheDirectory + fileName;
        await FileSystem.downloadAsync(imageUri, fileUri);
        await Sharing.shareAsync(fileUri);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not share the file');
    }
  };

  const handleShareInSlack = () => {
    setShowMenu(false);
    navigation.navigate('ShareFile', { slug, fileId, fileName });
  };

  const handleCopyLink = async () => {
    setShowMenu(false);
    await Clipboard.setStringAsync(imageUri);
    Alert.alert('Copied', 'Link copied to clipboard');
  };

  const handleViewInBrowser = () => {
    setShowMenu(false);
    Linking.openURL(imageUri);
  };

  const handleDownload = async () => {
    setShowMenu(false);
    setDownloading(true);

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to save photos');
        return;
      }

      const fileUri = FileSystem.cacheDirectory + fileName;
      const { uri } = await FileSystem.downloadAsync(imageUri, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Downloaded', 'Image saved to gallery');
    } catch (e) {
      Alert.alert('Error', 'Could not download the file');
    } finally {
      setDownloading(false);
    }
  };

  const handleAddToTodos = async () => {
    setShowMenu(false);
    // TODO: Implement add to todos API
    Alert.alert('Added', 'Added to your to-dos');
  };

  const handleSaveForLater = async () => {
    setShowMenu(false);
    try {
      await api(`/w/${slug}/files/${fileId}/save`, 'POST');
      Alert.alert('Saved', 'File saved for later');
    } catch (e) {
      Alert.alert('Error', 'Could not save the file');
    }
  };

  const handleEditDetails = () => {
    setShowMenu(false);
    // TODO: Navigate to edit details screen
    Alert.alert('Edit Details', 'Coming soon');
  };

  const handleDeleteFile = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete file',
      'Are you sure you want to delete this file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/w/${slug}/files/${fileId}`, 'DELETE');
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', 'Could not delete the file');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        <View style={styles.headerInfo}>
          <View style={styles.userRow}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>
          <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      {/* Shared Info */}
      {sharedIn && (
        <View style={styles.sharedInfo}>
          <Text style={styles.sharedText}>Shared in {sharedIn}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable style={styles.footerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chatbubble-outline" size={24} color="#fff" />
        </Pressable>

        <Pressable style={styles.footerButton} onPress={handleShareInSlack}>
          <Ionicons name="arrow-redo-outline" size={24} color="#fff" />
        </Pressable>

        <Pressable style={styles.footerButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={24} color="#fff" />
        </Pressable>

        <Pressable style={styles.footerButton} onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.menuHandle} />

            <Text style={styles.menuFileName} numberOfLines={1}>{fileName}</Text>

            <ScrollView style={styles.menuScroll}>
              <Pressable style={styles.menuItem} onPress={handleShareInSlack}>
                <Ionicons name="arrow-redo-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>Share in Slack</Text>
              </Pressable>

              <Pressable style={styles.menuItem} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>Share to another app</Text>
              </Pressable>

              <Pressable style={styles.menuItem} onPress={handleCopyLink}>
                <Ionicons name="link-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>Copy link</Text>
              </Pressable>

              <Pressable style={styles.menuItem} onPress={handleViewInBrowser}>
                <Ionicons name="open-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>View in browser</Text>
              </Pressable>

              <Pressable style={styles.menuItem} onPress={handleDownload}>
                <Ionicons name="download-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>{downloading ? 'Downloading...' : 'Download'}</Text>
              </Pressable>

              <View style={styles.menuDivider} />

              <Pressable style={styles.menuItem} onPress={handleAddToTodos}>
                <Ionicons name="checkmark-circle-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>Add to to-dos</Text>
              </Pressable>

              <Pressable style={styles.menuItem} onPress={handleSaveForLater}>
                <Ionicons name="bookmark-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>Save for later</Text>
              </Pressable>

              <View style={styles.menuDivider} />

              <Pressable style={styles.menuItem} onPress={handleEditDetails}>
                <Ionicons name="create-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>Edit details</Text>
              </Pressable>

              <Pressable style={styles.menuItem} onPress={handleDeleteFile}>
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
                <Text style={[styles.menuText, { color: colors.danger }]}>Delete file</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    closeButton: {
      padding: 4,
    },
    headerInfo: {
      flex: 1,
      marginLeft: 12,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 6,
    },
    avatarPlaceholder: {
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    userName: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    timestamp: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 13,
    },
    fileName: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 13,
      marginTop: 4,
    },
    headerRight: {
      width: 36,
    },
    imageContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    image: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT * 0.6,
    },
    sharedInfo: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    sharedText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 13,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingTop: 16,
    },
    footerButton: {
      padding: 12,
    },
    menuBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    menuSheet: {
      backgroundColor: colors.dark,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 12,
      maxHeight: '70%',
    },
    menuHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.line,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    menuFileName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    menuScroll: {
      paddingHorizontal: 20,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingVertical: 14,
    },
    menuText: {
      color: colors.text,
      fontSize: 16,
    },
    menuDivider: {
      height: 1,
      backgroundColor: colors.line,
      marginVertical: 8,
    },
  });
