import { useState, useEffect } from 'react';

function findVoice(langPrefixes: string[]): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const prefixes = langPrefixes.map(prefix => prefix.toLowerCase());
  return window.speechSynthesis.getVoices().find(voice => {
    const lang = voice.lang.toLowerCase();
    return prefixes.some(prefix => lang.startsWith(prefix));
  }) ?? null;
}

interface Props {
  text: string;
  enabled?: boolean;
  langPrefixes: string[];
}

export default function SpeakButton({ text, enabled = false, langPrefixes }: Props) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() => findVoice(langPrefixes));

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const update = () => setVoice(findVoice(langPrefixes));
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, [langPrefixes]);

  if (!enabled || !voice || !text) return null;

  function speak() {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice!.lang;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      onClick={speak}
      aria-label={`Hear "${text}" pronounced`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
    >
      Hear it
    </button>
  );
}
