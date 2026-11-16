import { useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Peer = any;
export type Stream = any;
export type Track = any;

export const huddleSupported = typeof RTCPeerConnection !== 'undefined';

export const getMedia = (constraints: object): Promise<Stream> => navigator.mediaDevices.getUserMedia(constraints);

export const createPeer = (iceServers: { urls: string }[]): Peer => new RTCPeerConnection({ iceServers });

export const streamOf = (track: Track): Stream => new MediaStream([track]);

export function VideoView({ stream, mirror, contain, style }: { stream: Stream; mirror?: boolean; contain?: boolean; style?: StyleProp<ViewStyle> }) {
  const element = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (element.current) element.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      autoPlay
      data-huddle-video
      muted
      playsInline
      ref={element}
      style={{
        ...(style as object),
        objectFit: contain ? 'contain' : 'cover',
        transform: mirror ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}

export function RemoteAudio({ stream }: { stream: Stream }) {
  const element = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (element.current) element.current.srcObject = stream;
  }, [stream]);

  return <audio autoPlay data-huddle-audio ref={element} />;
}
