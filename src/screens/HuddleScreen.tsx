import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, getSession } from '../api';
import { RootStack } from '../navigation';
import { joinPresence, leavePresence } from '../realtime';
import { useTheme } from '../ui';
import { ThemeColors } from '../theme';
import { createPeer, getMedia, huddleSupported, Peer, RemoteAudio, Stream, streamOf, Track, VideoView } from '../webrtc';

interface Person {
  id: number;
  name: string;
}

interface Signal {
  from: number;
  to: number;
  description?: object & { type?: string };
  candidate?: object;
}

type VideoKind = 'camera' | 'screen' | null;

// STUN finds a direct route. Networks that block direct media also need a TURN server.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const videoTransceiver = (peer: Peer) =>
  peer.getTransceivers().find((transceiver: Peer) => transceiver.receiver.track.kind === 'video');

const plain = (value: Peer) => (value?.toJSON ? value.toJSON() : value);

/** The same signalling as the web huddle, so phones and browsers share one call. Leaving this screen leaves the huddle. */
export default function HuddleScreen({ navigation, route }: NativeStackScreenProps<RootStack, 'Huddle'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { slug, channelId, title } = route.params;
  const me = getSession()?.user;

  const [joined, setJoined] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [muted, setMuted] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [localStream, setLocalStream] = useState<Stream | null>(null);
  const [remoteVideo, setRemoteVideo] = useState<Record<number, Stream>>({});
  const [remoteAudio, setRemoteAudio] = useState<Record<number, Stream>>({});
  const [remoteKinds, setRemoteKinds] = useState<Record<number, VideoKind>>({});
  const [error, setError] = useState<string | null>(null);

  const audio = useRef<Stream | null>(null);
  const videoTrack = useRef<Track | null>(null);
  const peers = useRef(new Map<number, Peer>());
  const announce = useRef<() => void>(() => {});
  const room = `presence-huddle.${channelId}`;

  const closePeer = (id: number) => {
    peers.current.get(id)?.close();
    peers.current.delete(id);
    const without = <T,>({ [id]: _, ...rest }: Record<number, T>) => rest;
    setRemoteVideo(without);
    setRemoteAudio(without);
    setRemoteKinds(without);
  };

  const setTrack = (track: Track | null) => {
    videoTrack.current?.stop();
    videoTrack.current = track;
    setLocalStream(track ? streamOf(track) : null);
    peers.current.forEach((peer) => videoTransceiver(peer)?.sender.replaceTrack(track));
    announce.current();
  };

  useEffect(() => {
    let left = false;

    const start = async () => {
      if (!huddleSupported || !me) return;

      try {
        audio.current = await getMedia({ audio: true });
      } catch {
        setError('Microphone access is needed for a huddle.');
        return;
      }

      if (left) {
        audio.current.getTracks().forEach((track: Track) => track.stop());
        return;
      }

      const channel = joinPresence(room);

      if (!channel) {
        setError('Could not join the huddle.');
        return;
      }

      const signal = (data: Omit<Signal, 'from'>) => channel.trigger('client-signal', { ...data, from: me.id });

      announce.current = () =>
        channel.trigger('client-media', { from: me.id, kind: videoTrack.current ? 'camera' : null });

      const connectTo = (id: number, caller: boolean) => {
        const peer = createPeer(ICE_SERVERS);
        peers.current.set(id, peer);

        audio.current?.getTracks().forEach((track: Track) => peer.addTrack(track, audio.current));

        // A video slot exists from the start, so the camera can switch without reconnecting.
        if (caller) peer.addTransceiver('video', { direction: 'sendrecv' }).sender.replaceTrack(videoTrack.current);

        peer.addEventListener('icecandidate', ({ candidate }: Peer) => {
          if (candidate) signal({ to: id, candidate: plain(candidate) });
        });
        peer.addEventListener('track', ({ track }: Peer) => {
          const set = track.kind === 'video' ? setRemoteVideo : setRemoteAudio;
          set((current) => ({ ...current, [id]: streamOf(track) }));
        });

        return peer;
      };

      channel.bind('pusher:subscription_succeeded', async (members: Peer) => {
        const everyone: Person[] = [];
        members.each((member: Peer) => everyone.push({ id: Number(member.id), name: member.info.name }));
        setPeople(everyone);
        setJoined(true);

        const others = everyone.filter((person) => person.id !== me.id);

        if (others.length === 0) {
          api(`/w/${slug}/c/${channelId}/huddle`, 'POST').catch(() => {});
          api(`/w/${slug}/c/${channelId}/messages`, 'POST', {
            body: '🎧 started a huddle. Choose Huddle in this conversation to join.',
          }).catch(() => {});
        }

        // The newcomer calls everyone already in the room.
        for (const person of others) {
          const peer = connectTo(person.id, true);
          await peer.setLocalDescription(await peer.createOffer());
          signal({ to: person.id, description: plain(peer.localDescription) });
        }
      });

      channel.bind('pusher:subscription_error', () => setError('Could not join the huddle.'));

      channel.bind('pusher:member_added', (member: Peer) =>
        setPeople((current) => [...current, { id: Number(member.id), name: member.info.name }]),
      );

      channel.bind('pusher:member_removed', (member: Peer) => {
        closePeer(Number(member.id));
        setPeople((current) => current.filter((person) => person.id !== Number(member.id)));
      });

      channel.bind('client-media', ({ from, kind }: { from: number; kind: VideoKind }) =>
        setRemoteKinds((current) => ({ ...current, [from]: kind })),
      );

      channel.bind('client-signal', async ({ from, to, description, candidate }: Signal) => {
        if (to !== me.id) return;

        const peer = peers.current.get(from) ?? connectTo(from, false);

        if (description) {
          await peer.setRemoteDescription(description);

          if (description.type === 'offer') {
            const video = videoTransceiver(peer);
            if (video) {
              video.direction = 'sendrecv';
              await video.sender.replaceTrack(videoTrack.current);
            }
            await peer.setLocalDescription(await peer.createAnswer());
            signal({ to: from, description: plain(peer.localDescription) });
          }

          // Tells someone who just connected what this person is already showing.
          announce.current();
        } else if (candidate) {
          await peer.addIceCandidate(candidate).catch(() => {});
        }
      });
    };

    start();

    return () => {
      left = true;
      [...peers.current.values()].forEach((peer) => peer.close());
      peers.current.clear();
      videoTrack.current?.stop();
      audio.current?.getTracks().forEach((track: Track) => track.stop());
      announce.current = () => {};
      leavePresence(room);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  const toggleMute = () => {
    audio.current?.getAudioTracks().forEach((track: Track) => {
      track.enabled = muted;
    });
    setMuted(!muted);
  };

  const startCamera = async (side: 'user' | 'environment') => {
    setError(null);
    try {
      const stream = await getMedia({ video: { facingMode: side } });
      setTrack(stream.getVideoTracks()[0]);
      setFacing(side);
    } catch {
      setError('Camera access is needed for video.');
    }
  };

  if (!huddleSupported) {
    return (
      <View style={styles.screen}>
        <Text style={styles.notice}>Huddles need the full Ping Chat app. They do not run in Expo Go.</Text>
      </View>
    );
  }

  const nameOf = (id: number) => people.find((person) => person.id === id)?.name ?? 'Someone';
  const tiles = Object.entries(remoteVideo).filter(([id]) => remoteKinds[Number(id)]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.count}>
        {joined ? `${people.length} in huddle: ${people.map((person) => person.name).join(', ')}` : 'Joining…'}
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.tiles} style={styles.stage}>
        {tiles.map(([id, stream]) => (
          <View key={id} style={styles.tile}>
            <VideoView contain={remoteKinds[Number(id)] === 'screen'} stream={stream} style={styles.video} />
            <Text style={styles.tileName}>{nameOf(Number(id))}</Text>
          </View>
        ))}
        {localStream && (
          <View style={styles.tile}>
            <VideoView mirror={facing === 'user'} stream={localStream} style={styles.video} />
            <Text style={styles.tileName}>You</Text>
          </View>
        )}
      </ScrollView>

      {Object.entries(remoteAudio).map(([id, stream]) => (
        <RemoteAudio key={id} stream={stream} />
      ))}

      <View style={styles.controls}>
        <Pressable
          accessibilityLabel={muted ? 'Unmute' : 'Mute'}
          accessibilityRole="button"
          onPress={toggleMute}
          style={[styles.control, muted && styles.controlOff]}
        >
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={22} color="#ffffff" />
        </Pressable>
        <Pressable
          accessibilityLabel={localStream ? 'Stop video' : 'Start video'}
          accessibilityRole="button"
          onPress={() => (localStream ? setTrack(null) : startCamera(facing))}
          style={[styles.control, !localStream && styles.controlOff]}
        >
          <Ionicons name={localStream ? 'videocam' : 'videocam-off'} size={22} color="#ffffff" />
        </Pressable>
        {localStream && (
          <Pressable
            accessibilityLabel="Flip camera"
            accessibilityRole="button"
            onPress={() => startCamera(facing === 'user' ? 'environment' : 'user')}
            style={styles.control}
          >
            <Ionicons name="camera-reverse" size={22} color="#ffffff" />
          </Pressable>
        )}
        <Pressable
          accessibilityLabel="Leave huddle"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={[styles.control, styles.leave]}
        >
          <Ionicons name="call" size={22} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

// A huddle keeps a dark stage whatever the theme, the way a call screen does,
// but its chrome still follows the chosen colours.
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { backgroundColor: colors.sidebar, flex: 1, padding: 16 },
    title: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
    count: { color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    notice: { color: '#ffffff', fontSize: 16, lineHeight: 24, marginTop: 40, textAlign: 'center' },
    error: { color: colors.danger, marginTop: 8 },
    stage: { flex: 1, marginVertical: 12 },
    tiles: { gap: 8 },
    tile: { backgroundColor: '#000000', borderRadius: 10, height: 220, overflow: 'hidden' },
    video: { height: '100%', width: '100%' },
    tileName: {
      backgroundColor: 'rgba(0,0,0,0.6)',
      bottom: 6,
      color: '#ffffff',
      fontSize: 12,
      left: 6,
      paddingHorizontal: 6,
      position: 'absolute',
    },
    controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', paddingBottom: 8 },
    control: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: 26,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    controlOff: { backgroundColor: 'rgba(255,255,255,0.08)' },
    leave: { backgroundColor: colors.danger },
  });
