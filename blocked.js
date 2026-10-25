async function main() {
  let pendingBlock = null;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getBlockedPageDetails' });
    if (response && response.ok && response.pendingBlock) pendingBlock = response.pendingBlock;
  } catch (error) {
    console.warn('[CleanShield] Could not retrieve blocked page details.');
  }

  if (pendingBlock && pendingBlock.host) {
    document.getElementById('host').textContent = pendingBlock.host;
    document.getElementById('detail').textContent =
      'Requested at ' + new Date(pendingBlock.ts).toLocaleTimeString();
  } else {
    document.getElementById('host').textContent = 'the requested site';
    document.getElementById('detail').textContent = 'No request detail is stored.';
  }

  document.getElementById('back').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else chrome.tabs.create({ url: 'chrome://newtab' });
  });
}

main();
