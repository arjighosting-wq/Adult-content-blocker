async function main() {
  const { pendingBlock } = await chrome.storage.local.get('pendingBlock');
  if (pendingBlock && pendingBlock.host) {
    document.getElementById('host').textContent = pendingBlock.host;
    document.getElementById('detail').textContent =
      'Requested at ' + new Date(pendingBlock.ts).toLocaleTimeString();
    // Privacy: clear immediately after showing, keep only the aggregate counter.
    await chrome.storage.local.remove('pendingBlock');
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
