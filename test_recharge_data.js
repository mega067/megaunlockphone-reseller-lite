const item = {
    date: new Date().toISOString(),
    username: 'user',
    amount: 50,
    type: 'SPEI',
    adminUsername: 'Sistema',
    serverId: '3',
    trackingNumber: 'NU3AM6I425B88K3O9I3ON5EJ4JNS',
    senderBankName: 'BBVA',
    receiverBankName: 'NU MEXICO'
};

const escapeHtml = (unsafe) => String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function formatType(type) {
  if (type === 'SPEI' || type === 'SPEI / Banxico') return '<span style="color:#10b981;">SPEI / Banco</span>';
  return escapeHtml(type);
}

const html = `<td>${formatType(item.type || item.method)}${item.trackingNumber ? `<br><small style="color:var(--text-muted);font-size:0.75rem;">Rastreo: ${escapeHtml(item.trackingNumber)}</small>` : ''}${item.senderBankName && item.receiverBankName ? `<br><small style="color:var(--text-muted);font-size:0.70rem; white-space:nowrap;">${escapeHtml(item.senderBankName)} ➔ ${escapeHtml(item.receiverBankName)}</small>` : ''}</td>`;
console.log(html);
