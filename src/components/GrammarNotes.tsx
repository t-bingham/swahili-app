import React from 'react';

// ─── Block types ──────────────────────────────────────────────────────────────

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseNotes(raw: string): Block[] {
  // Normalize orphaned bullets: "•\ncontent" → "• content"
  const text = raw
    .replace(/•[ \t]*\n[ \t]*([^•\n-])/g, '• $1')
    .replace(/^[ \t]+/gm, '')   // strip leading whitespace per line
    .trim();

  const blocks: Block[] = [];

  for (const chunk of text.split(/\n\n+/)) {
    const section = chunk.trim();
    if (!section) continue;

    const lines = section.split('\n').map(l => l.trim()).filter(Boolean);

    // Process line by line to handle headings mixed with lists in one chunk
    let i = 0;
    const pendingList: string[] = [];

    function flushList() {
      if (pendingList.length) {
        blocks.push({ type: 'list', items: [...pendingList] });
        pendingList.length = 0;
      }
    }

    while (i < lines.length) {
      const line = lines[i];

      // Heading: # / ## / ###
      const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        flushList();
        blocks.push({
          type: 'heading',
          level: headingMatch[1].length as 1 | 2 | 3,
          text: headingMatch[2],
        });
        i++;
        continue;
      }

      // Bullet: • or -
      if (/^[•\-]/.test(line)) {
        pendingList.push(line.replace(/^[•\-]\s*/, ''));
        i++;
        continue;
      }

      // Plain text — flush any pending list first
      flushList();
      // Collect consecutive non-special lines into one paragraph
      const paraLines: string[] = [];
      while (i < lines.length && !/^[#•\-]/.test(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length) {
        blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
      }
    }

    flushList();
  }

  return blocks;
}

// ─── Inline bold renderer ─────────────────────────────────────────────────────

function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="text-slate-100 font-semibold">{part.slice(2, -2)}</strong>
          : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GrammarNotesProps {
  notes: string;
  /** Use 'lesson' for the larger full-screen lesson view */
  variant?: 'detail' | 'lesson';
}

export default function GrammarNotes({ notes, variant = 'detail' }: GrammarNotesProps) {
  const blocks = parseNotes(notes);
  const textSize = variant === 'lesson' ? 'text-base' : 'text-sm';

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          const cls =
            block.level === 1 ? 'text-lg font-bold text-slate-100' :
            block.level === 2 ? 'text-base font-semibold text-slate-100' :
            'text-sm font-semibold text-slate-200';
          return (
            <p key={i} className={cls}>
              <Bold text={block.text} />
            </p>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={i} className="space-y-2">
              {block.items.map((item, j) => (
                <li key={j} className={`flex gap-2.5 ${textSize} text-slate-300`}>
                  <span className="text-cyan-400 shrink-0 mt-0.5 select-none">•</span>
                  <span><Bold text={item} /></span>
                </li>
              ))}
            </ul>
          );
        }

        // paragraph
        return (
          <p key={i} className={`${textSize} text-slate-300 leading-relaxed`}>
            <Bold text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
