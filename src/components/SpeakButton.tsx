import { useState, useEffect } from 'react';
import { findSpeechVoice, hasSpeechSynthesis, onSpeechVoicesChanged, speakText } from '../platform/speech';

interface Props {
  text: string;
  enabled?: boolean;
  langPrefixes: string[];
}

export default function SpeakButton({ text, enabled = false, langPrefixes }: Props) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() => findSpeechVoice(langPrefixes));

  useEffect(() => {
    if (!hasSpeechSynthesis()) return;
    const update = () => setVoice(findSpeechVoice(langPrefixes));
    update();
    return onSpeechVoicesChanged(update);
  }, [langPrefixes]);

  if (!enabled || !voice || !text) return null;

  function speak() {
    if (!voice) return;
    speakText(text, voice);
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
