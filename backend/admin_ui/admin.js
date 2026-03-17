async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

const btnHealth = document.getElementById('btnHealth');
const healthEl = document.getElementById('health');
const healthOut = document.getElementById('healthOut');

btnHealth.addEventListener('click', async () => {
  btnHealth.disabled = true;
  healthOut.textContent = 'consultando...';
  try {
    const { ok, status, data } = await fetchJson('/health');
    healthEl.textContent = ok ? 'ok' : 'error';
    healthEl.className = ok ? 'status-ok' : 'status-bad';
    healthOut.textContent = JSON.stringify({ status, data }, null, 2);
  } finally {
    btnHealth.disabled = false;
  }
});

