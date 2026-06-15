import { useState, useEffect } from 'react';

// Find an installed Swahili voice, if any. Returns null when the device has none
// — we never fall back to an English-accented voice (that would teach the wrong
// pronunciation).
function findSwahiliVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('sw')) ?? null;
}

interface Props {
  text: string;
  enabled?: boolean;
}

// Learner-initiated browser TTS. Renders nothing unless the user has enabled audio
// AND the device actually has a Swahili voice installed.
export default function SpeakButton({ text, enabled = false }: Props) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(findSwahiliVoice);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    // getVoices() is often empty until the async voiceschanged event fires.
    const update = () => setVoice(findSwahiliVoice());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);

  if (!enabled || !voice || !text) return null;

  function speak() {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice!.lang;
    window.speechSynthesis.speak(u);
  }

  return (
    <button
      onClick={speak}
      aria-label={`Hear "${text}" pronounced`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
    >
      <span aria-hidden="true">🔊</span> Hear it
    </button>
  );
}
