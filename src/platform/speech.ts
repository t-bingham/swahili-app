export function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function findSpeechVoice(langPrefixes: string[]): SpeechSynthesisVoice | null {
  if (!hasSpeechSynthesis()) return null;
  const prefixes = langPrefixes.map(prefix => prefix.toLowerCase());
  return window.speechSynthesis.getVoices().find(voice => {
    const lang = voice.lang.toLowerCase();
    return prefixes.some(prefix => lang.startsWith(prefix));
  }) ?? null;
}

export function onSpeechVoicesChanged(callback: () => void): () => void {
  if (!hasSpeechSynthesis()) return () => {};
  window.speechSynthesis.addEventListener('voiceschanged', callback);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', callback);
}

export function speakText(text: string, voice: SpeechSynthesisVoice): void {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  window.speechSynthesis.speak(utterance);
}
