/**
 * Web Speech API helpers (Chrome/Edge/Android + Safari/iOS webkit)
 */

import type { Messages } from "@/lib/i18n/messages/ko";

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onerror:
    | ((
        this: SpeechRecognitionLike,
        ev: { error: string; message?: string },
      ) => void)
    | null;
  onresult:
    | ((
        this: SpeechRecognitionLike,
        ev: {
          resultIndex: number;
          results: ArrayLike<{
            isFinal: boolean;
            0: { transcript: string; confidence: number };
            length: number;
          }>;
        },
      ) => void)
    | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function getSpeechRecognitionConstructor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() != null;
}

export function isSecureSpeechContext(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  );
}

/** Ask for mic permission first on mobile to improve recognition success */
export async function ensureMicrophonePermission(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  stream.getTracks().forEach((track) => track.stop());
}

export function speechErrorMessage(errorCode: string, m: Messages["speech"]): string {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return m.micPermission;
    case "no-speech":
      return m.noSpeech;
    case "audio-capture":
      return m.micNotFound;
    case "network":
      return m.network;
    case "aborted":
      return "";
    default:
      return m.failed;
  }
}
