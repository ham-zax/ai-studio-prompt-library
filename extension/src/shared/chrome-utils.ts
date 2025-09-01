export function pRemoveAllContextMenus(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.contextMenus.removeAll(() => {
        const lastErr = (chrome.runtime as any).lastError;
        if (lastErr) {
          return reject(lastErr);
        }
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function pCreateContextMenu(properties: chrome.contextMenus.CreateProperties): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.contextMenus.create(properties, () => {
        const lastErr = (chrome.runtime as any).lastError;
        if (lastErr) {
          // Allow duplicate ID errors to pass silently (common during hot reloads)
          const msg = (lastErr as Error).message || '';
          if (!msg.includes('duplicate id') && !msg.includes('duplicate ID')) {
            return reject(lastErr);
          }
        }
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}
