function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

function showMsg(text, isError = false) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.className = 'msg ' + (isError ? 'error' : 'ok');
  if (text) setTimeout(() => (el.textContent = ''), 4000);
}

async function refresh() {
  const res = await send({ type: 'getStatus' });
  if (!res.ok) return showMsg(res.error, true);
  const s = res.status;

  document.getElementById('enabled').checked = s.enabled;
  document.getElementById('rulesApplied').textContent = String(s.rulesApplied);
  document.getElementById('blockedCount').textContent = String(s.blockedCount);
  document.getElementById('engine').textContent = s.engine;
  const diagRow = document.getElementById('diagRow');
  const diag = document.getElementById('diagnostics');
  if (s.ruleWarning) {
    diagRow.hidden = false;
    diag.textContent = s.ruleWarning;
  } else {
    diagRow.hidden = true;
    diag.textContent = '';
  }

  document.querySelectorAll('.seg button').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === s.mode);
  });

  const ul = document.getElementById('allowlist');
  ul.innerHTML = '';
  for (const d of s.allowlist) {
    const li = document.createElement('li');
    li.textContent = d;
    const rm = document.createElement('button');
    rm.textContent = 'Remove';
    rm.className = 'btn ghost small';
    rm.disabled = s.locked;
    rm.addEventListener('click', async () => {
      const r = await send({ type: 'removeAllowlist', domain: d });
      if (r.ok) refresh();
      else showMsg(r.error, true);
    });
    li.appendChild(rm);
    ul.appendChild(li);
  }

  document.getElementById('lockbadge').hidden = !s.locked;
  document.getElementById('lockCard').hidden = !s.hasAdminPassword;
  document.getElementById('lockRow').hidden = s.locked;
  document.getElementById('unlockForm').hidden = !s.locked;
  document.getElementById('enabled').disabled = s.locked;
  document.querySelectorAll('.seg button').forEach((b) => (b.disabled = s.locked));
  document.getElementById('allowDomain').disabled = s.locked;
  const allowSubmit = document.querySelector('#allowForm button');
  if (allowSubmit) allowSubmit.disabled = s.locked;
}

async function init() {
  document.getElementById('enabled').addEventListener('change', async (e) => {
    const r = await send({ type: 'toggleEnabled', enabled: e.target.checked });
    if (r.ok) refresh();
    else {
      showMsg(r.error, true);
      refresh();
    }
  });

  document.querySelectorAll('.seg button').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = await send({ type: 'setMode', mode: b.dataset.mode });
      if (r.ok) refresh();
      else showMsg(r.error, true);
    });
  });

  document.getElementById('allowForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const domain = document.getElementById('allowDomain').value.trim();
    const r = await send({ type: 'addAllowlist', domain });
    if (r.ok) {
      document.getElementById('allowDomain').value = '';
      refresh();
    } else showMsg(r.error, true);
  });

  document.getElementById('passForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = document.getElementById('currentPass').value;
    const pw = document.getElementById('newPass').value;
    const confirm = document.getElementById('confirmPass').value;
    if (pw.length < 8) return showMsg('Password must be at least 8 characters', true);
    if (pw !== confirm) return showMsg('Passwords do not match', true);
    const r = await send({ type: 'setPassword', currentPassword: current, password: pw });
    if (r.ok) {
      document.getElementById('currentPass').value = '';
      document.getElementById('newPass').value = '';
      document.getElementById('confirmPass').value = '';
      showMsg('Password saved');
      refresh();
    } else showMsg(r.error, true);
  });

  document.getElementById('lockBtn').addEventListener('click', async () => {
    const r = await send({ type: 'lock' });
    if (r.ok) refresh();
    else if (String(r.error).includes('set-admin-password-first')) {
      showMsg('Set an admin password before locking settings', true);
    } else showMsg(r.error, true);
  });

  document.getElementById('unlockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('unlockPass').value;
    const r = await send({ type: 'unlock', password });
    if (r.ok) {
      document.getElementById('unlockPass').value = '';
      showMsg('Settings unlocked');
      refresh();
    } else {
      showMsg('Incorrect password', true);
    }
  });

  await refresh();
}

init();
