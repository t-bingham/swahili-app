import type { CardWithState } from '../types';
import type { LanguageAdapter } from '../languages';

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function printFlashcards(cards: CardWithState[], language: LanguageAdapter): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(language.targetShortName)} Flashcards</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #111; }
  .info { padding: 12px 16px; font-size: 11px; color: #666; border-bottom: 1px solid #ddd; }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    padding: 0;
  }
  .card {
    border: 1px solid #ccc;
    height: 148px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .card-front {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-bottom: 1px dashed #bbb;
    background: #fafafa;
    min-height: 0;
  }
  .card-back {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    min-height: 0;
  }
  .sw { font-size: 18px; font-weight: bold; text-align: center; line-height: 1.2; }
  .pr { font-size: 10px; color: #666; font-style: italic; margin-top: 3px; }
  .en { font-size: 14px; font-weight: 600; text-align: center; line-height: 1.3; }
  .senses { font-size: 9px; color: #888; text-align: center; margin-top: 2px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .type-badge { font-size: 8px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }
  .fold-hint { font-size: 8px; color: #bbb; letter-spacing: 0.3px; text-align: center; padding: 1px 0; }
  @media print {
    body { margin: 0; }
    .info { display: none; }
    .grid { gap: 0; }
  }
  @page { margin: 10mm; size: A4 portrait; }
</style>
</head>
<body>
<div class="info">
  ${escapeHtml(language.targetShortName)} Flashcards - ${cards.length} cards - printed ${new Date().toLocaleDateString()}
  &nbsp;&middot;&nbsp; Fold each card along the dashed line, then cut along the outer borders.
  &nbsp;&middot;&nbsp; <button onclick="window.print()" style="cursor:pointer;">Print</button>
</div>
<div class="grid">
${cards.map(c => {
  const altMeanings = c.senses && c.senses.length > 1
    ? c.senses.slice(1, 3).map(s => s.english).join(', ')
    : '';
  const targetExample = language.getTargetExample(c);
  return `  <div class="card">
    <div class="card-front">
      <div class="sw">${escapeHtml(language.getTargetText(c))}</div>
      ${c.pronunciation ? `<div class="pr">[${escapeHtml(c.pronunciation)}]</div>` : ''}
      <div class="type-badge">${escapeHtml(c.type)}${c.register && c.register !== 'neutral' ? ' &middot; ' + escapeHtml(c.register) : ''}</div>
    </div>
    <div class="fold-hint">&middot; &middot; &middot; fold &middot; &middot; &middot;</div>
    <div class="card-back">
      <div class="en">${escapeHtml(language.getEnglishText(c))}</div>
      ${altMeanings ? `<div class="senses">also: ${escapeHtml(altMeanings)}</div>` : ''}
      ${targetExample ? `<div class="senses" style="font-style:italic;margin-top:3px;">"${escapeHtml(targetExample)}"</div>` : ''}
    </div>
  </div>`;
}).join('\n')}
</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Allow pop-ups to print flashcards.'); return; }
  win.document.write(html);
  win.document.close();
}
