import { NativeModules, StyleProp, ViewStyle } from 'react-native';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Peer = any;
export type Stream = any;
export type Track = any;

// Expo Go has no WebRTC module, and loading the library there would crash the whole app.
const webrtc = NativeModules.WebRTCModule ? require('react-native-webrtc') : null;

export const huddleSupported = Boolean(webrtc);

export const getMedia = (constraints: object): Promise<Stream> => webrtc.mediaDevices.getUserMedia(constraints);

export const createPeer = (iceServers: { urls: string }[]): Peer => new webrtc.RTCPeerConnection({ iceServers });

export const streamOf = (track: Track): Stream => new webrtc.MediaStream([track]);

export function VideoView({ stream, mirror, contain, style }: { stream: Stream; mirror?: boolean; contain?: boolean; style?: StyleProp<ViewStyle> }) {
  const { RTCView } = webrtc;

  return <RTCView mirror={mirror} objectFit={contain ? 'contain' : 'cover'} streamURL={stream.toURL()} style={style} />;
}

/** The phone plays incoming audio by itself. */
export function RemoteAudio(_: { stream: Stream }) {
  return null;
}
