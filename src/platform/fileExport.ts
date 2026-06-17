export interface FileExportOptions {
  filename: string;
  content: BlobPart;
  mimeType: string;
}

export function downloadFile({ filename, content, mimeType }: FileExportOptions): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, value: unknown): void {
  downloadFile({
    filename,
    content: JSON.stringify(value, null, 2),
    mimeType: 'application/json',
  });
}
