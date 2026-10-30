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
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { useI18n } from "@/lib/i18n/useI18n";

type UseSpeechToTextOptions = {
  lang?: string;
  onFinalTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
};

/**
 * Shared for Web/Android/iOS: continuous=false with a callback on final results
 * (continuous mode is often unstable on mobile)
 */
export function useSpeechToText({
  lang,
  onFinalTranscript,
  onInterimTranscript,
  onError,
  disabled = false,
}: UseSpeechToTextOptions) {
  const { locale, m } = useI18n();
  const speechLang = lang ?? LOCALE_TAGS[locale];
  const speechMessages = m.speech;
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
      onErrorRef.current?.(speechMessages.httpsOnly);
      return;
    }
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      onErrorRef.current?.(speechMessages.browserUnsupported);
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
      onErrorRef.current?.(speechMessages.micPermission);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = speechLang;
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
      const message = speechErrorMessage(event.error, speechMessages);
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
      onErrorRef.current?.(speechMessages.startFailed);
    }
  }, [cleanupRecognition, deliverFinal, disabled, speechLang, speechMessages]);

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
