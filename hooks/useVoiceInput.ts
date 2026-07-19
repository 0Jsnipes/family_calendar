"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceEventDraft } from "@/types";

export type VoiceInputKind = "event" | "task";

export type VoiceParseResponse =
  | { kind: "event"; transcript: string; event: VoiceEventDraft }
  | { kind: "task"; transcript: string; tasks: string[] };

type MinimalSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => MinimalSpeechRecognition;
  webkitSpeechRecognition?: new () => MinimalSpeechRecognition;
};

function getSpeechRecognitionCtor(): (new () => MinimalSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechRecognitionWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to read recording."));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read recording."));
    reader.readAsDataURL(blob);
  });
}

export function useVoiceInput(
  kind: VoiceInputKind,
  context: { referenceDate?: string; timezone?: string },
  onResult: (result: VoiceParseResponse) => void,
) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const hasSpeechApi = getSpeechRecognitionCtor() !== null;
  const hasMediaRecorder =
    typeof window !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";
  const isSupported = hasSpeechApi || hasMediaRecorder;

  const submitTranscript = useCallback(
    async (transcript: string) => {
      setIsProcessing(true);
      setError(null);

      try {
        const response = await fetch("/api/voice/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            transcript,
            referenceDate: context.referenceDate,
            timezone: context.timezone,
          }),
        });
        const payload = (await response.json()) as {
          error?: string;
          transcript?: string;
          event?: VoiceEventDraft;
          tasks?: string[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to process voice input.");
        }

        if (kind === "task") {
          onResult({ kind: "task", transcript: payload.transcript ?? transcript, tasks: payload.tasks ?? [] });
        } else if (payload.event) {
          onResult({ kind: "event", transcript: payload.transcript ?? transcript, event: payload.event });
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : "Unable to process voice input.",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [kind, context.referenceDate, context.timezone, onResult],
  );

  const submitAudio = useCallback(
    async (blob: Blob) => {
      setIsProcessing(true);
      setError(null);

      try {
        const audio = await blobToBase64(blob);
        const response = await fetch("/api/voice/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            audio,
            mimeType: blob.type || "audio/webm",
            referenceDate: context.referenceDate,
            timezone: context.timezone,
          }),
        });
        const payload = (await response.json()) as {
          error?: string;
          transcript?: string;
          event?: VoiceEventDraft;
          tasks?: string[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to process voice input.");
        }

        if (kind === "task") {
          onResult({ kind: "task", transcript: payload.transcript ?? "", tasks: payload.tasks ?? [] });
        } else if (payload.event) {
          onResult({ kind: "event", transcript: payload.transcript ?? "", event: payload.event });
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : "Unable to process voice input.",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [kind, context.referenceDate, context.timezone, onResult],
  );

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setIsListening(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        void submitAudio(blob);
      };

      recorder.start();
      setIsListening(true);
      setError(null);
    } catch {
      setError("Microphone access was denied.");
    }
  }, [submitAudio]);

  const start = useCallback(() => {
    if (isListening || isProcessing) return;
    setError(null);

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) void submitTranscript(transcript);
      };
      recognition.onerror = (event) => {
        if (event.error === "no-speech") {
          setError("Didn't catch that — try again.");
        } else if (event.error === "not-allowed") {
          setError("Microphone access was denied.");
        } else {
          setError("Voice input failed.");
        }
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      return;
    }

    if (hasMediaRecorder) {
      void startRecording();
      return;
    }

    setError("Voice input isn't supported in this browser.");
  }, [isListening, isProcessing, hasMediaRecorder, startRecording, submitTranscript]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      stopRecording();
    }
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { isSupported, isListening, isProcessing, error, start, stop };
}
