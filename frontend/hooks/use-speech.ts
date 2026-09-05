"use client";

import * as React from "react";

import type { ConversationTurn } from "@/types/api";

/**
 * Speaks a voice conversation out loud using the browser's speech synthesis.
 *
 * The demo provider produces no audio - it simulates a call rather than placing
 * one - so without this the live room showed a waveform over silence. Reading
 * the transcript aloud makes a simulated call actually feel like a call, while
 * remaining honest: this is the browser speaking a transcript, not a recording.
 *
 * Two pacing modes:
 *  - "live"     : the demo timeline advances faster than speech does, so when
 *                 speech falls behind it skips to the newest turn. Audio then
 *                 always matches what is on screen.
 *  - "playback" : reads a stored conversation start to finish, in order.
 */

const STORAGE_KEY = "hireflow-voice-playback";

export type SpeechMode = "live" | "playback";

function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/* --- Voice list as an external store ---------------------------------------
 * `speechSynthesis.getVoices()` returns a fresh array on every call and fills
 * asynchronously, so it is wrapped in a store with a cached, stable reference.
 */

const EMPTY_VOICES: SpeechSynthesisVoice[] = [];
let cachedVoices: SpeechSynthesisVoice[] = EMPTY_VOICES;

const voiceStore = {
  subscribe(onChange: () => void) {
    if (!isSupported()) return () => {};

    const refresh = () => {
      const next = window.speechSynthesis.getVoices();
      // Only swap the reference when the list actually changed.
      if (next.length !== cachedVoices.length) {
        cachedVoices = next;
        onChange();
      }
    };

    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  },
  getSnapshot: () => cachedVoices,
  getServerSnapshot: () => EMPTY_VOICES,
};

interface VoicePair {
  agent: SpeechSynthesisVoice | null;
  candidate: SpeechSynthesisVoice | null;
}

/** Prefer Indian English, then any English; give each speaker a distinct voice. */
function pickVoices(voices: SpeechSynthesisVoice[]): VoicePair {
  if (voices.length === 0) return { agent: null, candidate: null };

  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const pool = english.length > 0 ? english : voices;

  const indian = pool.filter((voice) => voice.lang.toLowerCase() === "en-in");
  const ranked = [...indian, ...pool.filter((voice) => !indian.includes(voice))];

  const looksFemale = (voice: SpeechSynthesisVoice) =>
    /heera|zira|susan|hazel|female|aria|neha|samantha|google uk english female/i.test(voice.name);

  const agent = ranked.find(looksFemale) ?? ranked[0] ?? null;
  const candidate = ranked.find((voice) => voice !== agent) ?? agent;

  return { agent, candidate };
}

/* --- Conversation playback -------------------------------------------------- */

interface UseSpeechOptions {
  turns: ConversationTurn[];
  mode: SpeechMode;
  enabled: boolean;
}

export function useConversationSpeech({ turns, mode, enabled }: UseSpeechOptions) {
  const supported = isSupported();
  const voices = React.useSyncExternalStore(
    voiceStore.subscribe,
    voiceStore.getSnapshot,
    voiceStore.getServerSnapshot,
  );

  const [speakingSequence, setSpeakingSequence] = React.useState<number | null>(null);
  // Browsers block speech synthesis until the page has had a user gesture.
  // When that happens we surface a prompt rather than failing silently.
  const [blocked, setBlocked] = React.useState(false);
  const [retryNonce, setRetryNonce] = React.useState(0);

  // Turn sequences already spoken (or deliberately skipped past).
  const spokenRef = React.useRef<Set<number>>(new Set());
  const busyRef = React.useRef(false);

  const voicePair = React.useMemo(() => pickVoices(voices), [voices]);

  // Pure external-system teardown: no React state is touched, so this is safe
  // to call from an effect. The visible "speaking" marker is derived instead.
  const cancelSpeech = React.useCallback(() => {
    if (!isSupported()) return;
    window.speechSynthesis.cancel();
    busyRef.current = false;
  }, []);

  const stop = React.useCallback(() => {
    cancelSpeech();
    setSpeakingSequence(null);
  }, [cancelSpeech]);

  // Silence immediately when switched off, and clean up on unmount.
  React.useEffect(() => {
    if (!enabled) cancelSpeech();
    return cancelSpeech;
  }, [enabled, cancelSpeech]);

  // Start from the top whenever the conversation itself changes.
  const conversationKey = turns[0]?.id ?? "";
  React.useEffect(() => {
    spokenRef.current = new Set();
  }, [conversationKey]);

  React.useEffect(() => {
    if (!supported || !enabled || turns.length === 0) return;

    const pump = () => {
      if (busyRef.current) return;

      const pending = turns.filter((turn) => !spokenRef.current.has(turn.sequence));
      if (pending.length === 0) return;

      // A live call skips ahead so the voice never drifts behind the transcript.
      const next = mode === "live" ? pending[pending.length - 1] : pending[0];
      const consumed = mode === "live" ? pending.map((turn) => turn.sequence) : [next.sequence];
      consumed.forEach((sequence) => spokenRef.current.add(sequence));

      const utterance = new SpeechSynthesisUtterance(next.content);
      const isAgent = next.speaker === "agent";
      const voice = isAgent ? voicePair.agent : voicePair.candidate;
      if (voice) utterance.voice = voice;

      // A subtle pitch/rate split keeps the two speakers distinguishable even
      // when the browser only exposes a single voice.
      utterance.rate = isAgent ? 1.06 : 1.0;
      utterance.pitch = isAgent ? 1.05 : 0.92;
      utterance.volume = 1;

      utterance.onstart = () => {
        setBlocked(false);
        setSpeakingSequence(next.sequence);
      };
      utterance.onend = () => {
        busyRef.current = false;
        setSpeakingSequence(null);
        pump();
      };
      utterance.onerror = () => {
        busyRef.current = false;
        setSpeakingSequence(null);
      };

      busyRef.current = true;
      window.speechSynthesis.speak(utterance);

      // If nothing is speaking shortly after the request, the browser refused
      // it for want of a user gesture.
      window.setTimeout(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          busyRef.current = false;
          // Give these turns back so a retry replays them rather than skipping.
          consumed.forEach((sequence) => spokenRef.current.delete(sequence));
          setBlocked(true);
        }
      }, 500);
    };

    pump();
  }, [turns, mode, enabled, supported, voicePair, retryNonce]);

  /** Called from a click, which satisfies the browser's gesture requirement. */
  const retry = React.useCallback(() => {
    setBlocked(false);
    setRetryNonce((current) => current + 1);
  }, []);

  return {
    supported,
    stop,
    /** True when the browser refused to speak until the user interacts. */
    blocked: blocked && enabled,
    retry,
    /** Sequence number of the turn currently being spoken, if any. */
    speakingIndex: enabled ? speakingSequence : null,
    voiceName: voicePair.agent?.name ?? null,
  };
}

/* --- Sound preference, remembered across pages ------------------------------ */

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

const preferenceStore = {
  listeners: new Set<() => void>(),
  value: true,
  initialised: false,
  subscribe(listener: () => void) {
    if (!preferenceStore.initialised) {
      preferenceStore.value = readPreference();
      preferenceStore.initialised = true;
    }
    preferenceStore.listeners.add(listener);
    return () => preferenceStore.listeners.delete(listener);
  },
  getSnapshot: () => preferenceStore.value,
  // Sound defaults on, and the server cannot know otherwise.
  getServerSnapshot: () => true,
  set(next: boolean) {
    preferenceStore.value = next;
    preferenceStore.initialised = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      /* Storage unavailable: keep the choice in memory only. */
    }
    preferenceStore.listeners.forEach((listener) => listener());
  },
};

export function useVoicePlaybackPreference() {
  const enabled = React.useSyncExternalStore(
    preferenceStore.subscribe,
    preferenceStore.getSnapshot,
    preferenceStore.getServerSnapshot,
  );

  const toggle = React.useCallback(() => preferenceStore.set(!preferenceStore.value), []);
  const setEnabled = React.useCallback((next: boolean) => preferenceStore.set(next), []);

  return { enabled, toggle, setEnabled };
}
