/**
 * Web Speech API 헬퍼 (Chrome/Edge/Android + Safari/iOS webkit)
 */

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

/** iOS Safari는 continuous/긴 세션이 불안정한 경우가 많음 */
export function isAppleMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/i.test(ua);
  const iPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

export function isSecureSpeechContext(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  );
}

/** 모바일에서 마이크 권한 프롬프트를 먼저 띄워 인식 성공률을 높임 */
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

export function speechErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return "마이크 권한이 필요해요. 브라우저/기기 설정에서 마이크를 허용해 주세요.";
    case "no-speech":
      return "음성이 감지되지 않았어요. 다시 말씀해 주세요.";
    case "audio-capture":
      return "마이크를 찾을 수 없어요. 연결 상태를 확인해 주세요.";
    case "network":
      return "음성 인식 네트워크 오류예요. 인터넷 연결 후 다시 시도해 주세요.";
    case "aborted":
      return "";
    default:
      return "음성 인식에 실패했어요. 다시 시도해 주세요.";
  }
}
