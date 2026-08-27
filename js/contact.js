const ContactCodec = (() => {
  const PREFIX = 'MM1:';

  function encode(profile) {
    const payload = {
      n: profile.name || '',
      t: profile.title || '',
      c: profile.company || '',
      e: profile.email || '',
      p: profile.phone || '',
      w: profile.website || ''
    };
    return PREFIX + JSON.stringify(payload);
  }

  function decode(text) {
    if (typeof text !== 'string' || !text.startsWith(PREFIX)) return null;
    try {
      const payload = JSON.parse(text.slice(PREFIX.length));
      return {
        name: payload.n || '',
        title: payload.t || '',
        company: payload.c || '',
        email: payload.e || '',
        phone: payload.p || '',
        website: payload.w || ''
      };
    } catch (e) {
      return null;
    }
  }

  function vCardEscape(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  function toVCard(contact) {
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${vCardEscape(contact.name)}`,
      `N:${vCardEscape(contact.name)};;;;`
    ];
    if (contact.company) lines.push(`ORG:${vCardEscape(contact.company)}`);
    if (contact.title) lines.push(`TITLE:${vCardEscape(contact.title)}`);
    if (contact.email) lines.push(`EMAIL:${vCardEscape(contact.email)}`);
    if (contact.phone) lines.push(`TEL:${vCardEscape(contact.phone)}`);
    if (contact.website) lines.push(`URL:${vCardEscape(contact.website)}`);
    if (contact.notes) lines.push(`NOTE:${vCardEscape(contact.notes)}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }

  function csvEscape(str) {
    const s = String(str == null ? '' : str);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(contacts) {
    const header = ['Name', 'Title', 'Company', 'Email', 'Phone', 'Website', 'Notes', 'Scanned at'];
    const rows = contacts.map(c => [
      c.name, c.title, c.company, c.email, c.phone, c.website, c.notes,
      c.scannedAt ? new Date(c.scannedAt).toLocaleString() : ''
    ].map(csvEscape).join(','));
    return [header.join(','), ...rows].join('\r\n');
  }

  function downloadTextFile(filename, mimeType, text) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { encode, decode, toVCard, toCsv, downloadTextFile };
})();
