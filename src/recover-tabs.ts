export async function recoverOpenReels(): Promise<void> {
  const tabs = await chrome.tabs
    .query({ url: 'https://www.facebook.com/reel/*' })
    .catch(() => []);
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) return;
      try {
        if (
          (await chrome.tabs.sendMessage(tab.id, 'facebook-reel-date/ping')) === 'ready'
        )
          return;
      } catch {
        // The old content script may no longer be connected to the extension.
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['main.js'],
          world: 'MAIN',
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
          world: 'ISOLATED',
        });
      } catch {
        // A tab can close or navigate while recovery is in progress.
      }
    }),
  );
}
