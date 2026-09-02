/**
 * Safely copies text to the user's clipboard, handling iframe sandbox environments
 * where navigator.clipboard may be undefined or throw permission errors.
 */
export function safeCopyToClipboard(text: string): boolean {
  if (navigator.clipboard) {
    try {
      navigator.clipboard.writeText(text).catch((err) => {
        console.warn('Modern clipboard API failed, falling back.', err);
        return fallbackCopy(text);
      });
      return true;
    } catch (e) {
      console.warn('Modern clipboard API threw an exception, falling back.', e);
      return fallbackCopy(text);
    }
  }
  return fallbackCopy(text);
}

function fallbackCopy(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Position out of sight entirely
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Fallback clipboard writing failed:', err);
    return false;
  }
}
