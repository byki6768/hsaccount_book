"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureMicrophonePermission,
  getSpeechRecognitionConstructor,
  isSecureSpeechContext,
  isSpeechRecognitionSupported,
  speechErrorMessage,
  type SpeechRecognitionLike,
} from "@/lib/speechRecognition";

type UseSpeechToTextOptions = {
  lang?: string;
  onFinalTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
};

/**
 * Web/Android/iOS 공통: continuous=false + final 시 콜백
 * (continuous는 모바일에서 불안정한 경우가 많음)
 */
export function useSpeechToText({
  lang = "ko-KR",
  onFinalTranscript,
  onInterimTranscript,
  onError,
  disabled = false,
}: UseSpeechToTextOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [securable, setSecurable] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const deliveredRef = useRef(false);
  const finalBufferRef = useRef("");
  const onFinalRef = useRef(onFinalTranscript);
  const onInterimRef = useRef(onInterimTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
    onInterimRef.current = onInterimTranscript;
    onErrorRef.current = onError;
  }, [onFinalTranscript, onInterimTranscript, onError]);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
    setSecurable(isSecureSpeechContext());
  }, []);

  const cleanupRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    rec.onstart = null;
    rec.onend = null;
    rec.onerror = null;
    rec.onresult = null;
    try {
      rec.abort();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
  }, []);

  useEffect(() => () => cleanupRecognition(), [cleanupRecognition]);

  const deliverFinal = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || deliveredRef.current) return;
    deliveredRef.current = true;
    onFinalRef.current(trimmed);
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    setListening(false);
    const pending = finalBufferRef.current.trim();
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          // ignore
        }
      }
    }
    if (pending) {
      deliverFinal(pending);
      finalBufferRef.current = "";
    }
  }, [deliverFinal]);

  const start = useCallback(async () => {
    if (disabled) return;
    if (!isSecureSpeechContext()) {
      onErrorRef.current?.(
        "음성 인식은 HTTPS(또는 localhost)에서만 사용할 수 있어요.",
      );
      return;
    }
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      onErrorRef.current?.(
        "이 브라우저에서는 음성 인식을 지원하지 않아요. Chrome 또는 Safari(최신)를 사용해 주세요.",
      );
      return;
    }

    cleanupRecognition();
    finalBufferRef.current = "";
    deliveredRef.current = false;
    activeRef.current = true;

    try {
      await ensureMicrophonePermission();
    } catch {
      activeRef.current = false;
      onErrorRef.current?.(
        "마이크 권한이 필요해요. 브라우저·기기 설정에서 마이크를 허용해 주세요.",
      );
      return;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      if (activeRef.current) setListening(true);
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalized = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalized += transcript;
        else interim += transcript;
      }

      if (finalized) {
        finalBufferRef.current = `${finalBufferRef.current} ${finalized}`.trim();
      }

      const preview = `${finalBufferRef.current} ${interim}`.trim();
      if (preview) onInterimRef.current?.(preview);

      if (finalized) {
        const text = finalBufferRef.current.trim();
        if (text) {
          activeRef.current = false;
          setListening(false);
          deliverFinal(text);
          finalBufferRef.current = "";
          try {
            recognition.stop();
          } catch {
            // ignore
          }
        }
      }
    };

    recognition.onerror = (event) => {
      const message = speechErrorMessage(event.error);
      if (message) onErrorRef.current?.(message);
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed" ||
        event.error === "audio-capture"
      ) {
        activeRef.current = false;
        setListening(false);
      }
    };

    recognition.onend = () => {
      setListening(false);
      if (!deliveredRef.current) {
        const text = finalBufferRef.current.trim();
        if (text) {
          deliverFinal(text);
          finalBufferRef.current = "";
        }
      }
      activeRef.current = false;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      activeRef.current = false;
      setListening(false);
      onErrorRef.current?.("음성 인식을 시작할 수 없어요. 다시 눌러 주세요.");
    }
  }, [cleanupRecognition, deliverFinal, disabled, lang]);

  const toggle = useCallback(() => {
    if (listening || activeRef.current) {
      stop();
      return;
    }
    void start();
  }, [listening, start, stop]);

  return {
    supported,
    securable,
    listening,
    start,
    stop,
    toggle,
  };
}
