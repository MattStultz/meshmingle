(() => {
  let pendingAfterSettingsSave = null;
  let savesView = 'events'; // 'events' | 'detail'
  let savesActiveEventId = null;
  let shareTab = 'professional';
  let settingsProfileKind = 'professional';

  let mediaStream = null;
  let scanRAF = null;
  let scanning = false;

  const $ = (id) => document.getElementById(id);

  function navigate(screenId, opts = {}) {
    const targetShareTab = opts.shareTab || 'professional';
    const isProfileTab = targetShareTab === 'professional' || targetShareTab === 'personal';

    if (screenId === 'share' && isProfileTab && !Storage.hasProfile(targetShareTab)) {
      pendingAfterSettingsSave = targetShareTab;
      settingsProfileKind = targetShareTab;
      renderSettings();
      showScreen('settings');
      return;
    }
    if (screenId !== 'capture') stopCamera();

    showScreen(screenId);

    if (screenId === 'main') renderMain();
    if (screenId === 'capture') { resetCaptureView(); startCamera(); }
    if (screenId === 'share') { renderShare(); setShareTab(targetShareTab); }
    if (screenId === 'saves') { savesView = 'events'; renderSaves(); }
    if (screenId === 'settings') { if (opts.profileKind) settingsProfileKind = opts.profileKind; renderSettings(); }
  }

  function goToSettingsForKind(kind) {
    pendingAfterSettingsSave = kind;
    navigate('settings', { profileKind: kind });
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('screen-' + screenId).classList.add('active');
  }

  // ---------- MAIN ----------
  function renderMain() {
    const id = Storage.getActiveEventId();
    const evt = id ? Storage.getEventById(id) : null;
    $('main-event-name').textContent = evt ? evt.name : 'No event selected';
  }

  $('main-get-app-btn').addEventListener('click', () => navigate('share', { shareTab: 'app' }));

  // ---------- CAPTURE ----------
  function resetCaptureView() {
    $('capture-result-view').classList.add('hidden');
    $('capture-scan-view').classList.remove('hidden');
    $('capture-status').textContent = 'Point the camera at a MeshMingle QR code.';
    const activeId = Storage.getActiveEventId();
    $('capture-no-event-banner').classList.toggle('hidden', !!activeId);
  }

  async function startCamera() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      const video = $('capture-video');
      video.srcObject = mediaStream;
      await video.play();
      scanning = true;
      scanLoop();
    } catch (err) {
      $('capture-status').textContent = 'Could not access the camera. Check your browser permissions and try again.';
    }
  }

  function stopCamera() {
    scanning = false;
    if (scanRAF) cancelAnimationFrame(scanRAF);
    scanRAF = null;
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
  }

  function scanLoop() {
    if (!scanning) return;
    const video = $('capture-video');
    const canvas = $('capture-canvas');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        const contact = ContactCodec.decode(code.data);
        if (contact) {
          scanning = false;
          showCaptureResult(contact);
          return;
        } else {
          $('capture-status').textContent = "That's not a MeshMingle code &mdash; keep scanning.";
        }
      }
    }
    scanRAF = requestAnimationFrame(scanLoop);
  }

  function showCaptureResult(contact) {
    $('capture-scan-view').classList.add('hidden');
    $('capture-result-view').classList.remove('hidden');

    $('result-avatar').textContent = initials(contact.name);
    $('result-name').textContent = contact.name || 'Unnamed contact';
    $('result-title-company').textContent = [contact.title, contact.company].filter(Boolean).join(' • ') || '—';
    $('result-email').textContent = contact.email ? '✉ ' + contact.email : '';
    $('result-phone').textContent = contact.phone ? '☎ ' + contact.phone : '';
    $('result-website').textContent = contact.website ? '🔗 ' + contact.website : '';
    $('result-notes').value = '';

    $('result-save-btn').onclick = () => {
      const eventId = Storage.getActiveEventId() || Storage.ensureUncategorizedEvent();
      Storage.addContact(eventId, {
        id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        ...contact,
        notes: $('result-notes').value.trim(),
        scannedAt: Date.now()
      });
      navigate('main');
    };

    $('result-discard-btn').onclick = () => {
      resetCaptureView();
      scanning = true;
      scanLoop();
    };
  }

  function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  $('capture-create-event-btn').addEventListener('click', () => navigate('settings'));

  // ---------- SHARE ----------
  function updateShareKindPanel(kind) {
    const has = Storage.hasProfile(kind);
    $('share-' + kind + '-empty-msg').classList.toggle('hidden', has);
    $('share-' + kind + '-qr-wrap').classList.toggle('hidden', !has);
    $('share-' + kind + '-caption').classList.toggle('hidden', !has);
    $('share-' + kind + '-edit-btn').textContent = (has ? 'Edit ' : 'Add ') + kind + ' info';
  }

  function renderShare() {
    ['professional', 'personal'].forEach(kind => {
      const profile = Storage.getProfile(kind);
      if (profile) {
        QRCode.toCanvas($('share-qr-canvas-' + kind), ContactCodec.encode(profile), { width: 260, margin: 1 }, () => {});
        $('share-' + kind + '-caption').textContent = profile.name;
      }
      updateShareKindPanel(kind);
    });

    const appUrl = location.origin + location.pathname;
    QRCode.toCanvas($('share-app-qr-canvas'), appUrl, { width: 260, margin: 1 }, () => {});
  }

  function setShareTab(tab) {
    shareTab = tab;
    ['professional', 'personal', 'app'].forEach(t => {
      $('share-tab-' + t).classList.toggle('hidden', t !== tab);
    });
    document.querySelectorAll('.share-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
  }

  document.querySelectorAll('.share-tab-btn').forEach(b => {
    b.addEventListener('click', () => setShareTab(b.dataset.tab));
  });

  $('share-professional-edit-btn').addEventListener('click', () => goToSettingsForKind('professional'));
  $('share-personal-edit-btn').addEventListener('click', () => goToSettingsForKind('personal'));

  // ---------- SAVES ----------
  function renderSaves() {
    if (savesView === 'events') {
      $('saves-title').textContent = 'Saves';
      $('saves-events-view').classList.remove('hidden');
      $('saves-event-detail-view').classList.add('hidden');
      $('saves-back-btn').dataset.nav = 'main';
      $('saves-back-btn').onclick = null;

      const events = Storage.getEvents();
      const list = $('saves-events-list');
      list.innerHTML = '';

      if (events.length === 0) {
        list.innerHTML = '<li class="empty-state">No events yet. Create one from Settings.</li>';
        return;
      }

      events.forEach(evt => {
        const count = Storage.getContacts(evt.id).length;
        const li = document.createElement('li');
        li.innerHTML = `
          <button class="list-item">
            <span class="list-item-main">
              <p class="list-item-title">${escapeHtml(evt.name)}</p>
              <p class="list-item-sub">${count} contact${count === 1 ? '' : 's'}</p>
            </span>
          </button>`;
        li.querySelector('button').addEventListener('click', () => openEventDetail(evt.id));
        list.appendChild(li);
      });
    } else {
      renderEventDetail();
    }
  }

  function openEventDetail(eventId) {
    savesView = 'detail';
    savesActiveEventId = eventId;
    renderSaves();
  }

  function renderEventDetail() {
    const evt = Storage.getEventById(savesActiveEventId);
    $('saves-title').textContent = evt ? evt.name : 'Event';
    $('saves-events-view').classList.add('hidden');
    $('saves-event-detail-view').classList.remove('hidden');
    $('saves-back-btn').dataset.nav = '';
    $('saves-back-btn').onclick = () => { savesView = 'events'; renderSaves(); };

    const contacts = Storage.getContacts(savesActiveEventId);
    const list = $('saves-contacts-list');
    list.innerHTML = '';
    $('saves-empty-msg').classList.toggle('hidden', contacts.length !== 0);
    $('saves-export-csv-btn').onclick = () => {
      ContactCodec.downloadTextFile(
        sanitizeFilename(evt.name) + '.csv',
        'text/csv',
        ContactCodec.toCsv(contacts)
      );
    };

    contacts.forEach(c => {
      const li = document.createElement('li');
      li.className = 'list-item';
      li.innerHTML = `
        <span class="list-item-main">
          <p class="list-item-title">${escapeHtml(c.name || 'Unnamed contact')}</p>
          <p class="list-item-sub">${escapeHtml([c.title, c.company].filter(Boolean).join(' • ') || c.notes || '')}</p>
        </span>
        <span class="list-item-actions">
          <button class="icon-btn" aria-label="Export vCard" title="Export vCard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 19h14"/></svg>
          </button>
        </span>`;
      li.querySelector('.icon-btn').addEventListener('click', () => {
        ContactCodec.downloadTextFile(sanitizeFilename(c.name || 'contact') + '.vcf', 'text/vcard', ContactCodec.toVCard(c));
      });
      list.appendChild(li);
    });
  }

  function sanitizeFilename(name) {
    return (name || 'export').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '_') || 'export';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  // ---------- SETTINGS ----------
  function renderSettings() {
    const profile = Storage.getProfile(settingsProfileKind);
    $('settings-onboard-msg').classList.toggle('hidden', Storage.hasProfile(settingsProfileKind));

    $('profile-name').value = profile ? profile.name || '' : '';
    $('profile-title').value = profile ? profile.title || '' : '';
    $('profile-company').value = profile ? profile.company || '' : '';
    $('profile-email').value = profile ? profile.email || '' : '';
    $('profile-phone').value = profile ? profile.phone || '' : '';
    $('profile-website').value = profile ? profile.website || '' : '';

    document.querySelectorAll('.profile-kind-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.kind === settingsProfileKind);
    });

    renderEventSelect();
  }

  document.querySelectorAll('.profile-kind-tab').forEach(b => {
    b.addEventListener('click', () => {
      settingsProfileKind = b.dataset.kind;
      renderSettings();
    });
  });

  function renderEventSelect() {
    const events = Storage.getEvents();
    const activeId = Storage.getActiveEventId();
    const select = $('settings-event-select');
    select.innerHTML = '<option value="">No event selected</option>' +
      events.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
    select.value = activeId || '';
  }

  $('settings-event-select').addEventListener('change', (e) => {
    Storage.setActiveEventId(e.target.value || null);
  });

  $('settings-create-event-btn').addEventListener('click', () => {
    const input = $('settings-new-event-name');
    const name = input.value.trim();
    if (!name) return;
    Storage.createEvent(name);
    input.value = '';
    renderEventSelect();
  });

  function normalizeWebsite(value) {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
  }

  $('settings-profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('profile-name').value.trim();
    if (!name) return;

    Storage.saveProfile(settingsProfileKind, {
      name,
      title: $('profile-title').value.trim(),
      company: $('profile-company').value.trim(),
      email: $('profile-email').value.trim(),
      phone: $('profile-phone').value.trim(),
      website: normalizeWebsite($('profile-website').value)
    });

    const redirectShareTab = pendingAfterSettingsSave;
    pendingAfterSettingsSave = null;
    if (redirectShareTab) {
      navigate('share', { shareTab: redirectShareTab });
    } else {
      navigate('main');
    }
  });

  // ---------- NAV WIRING ----------
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      if (el.dataset.nav) navigate(el.dataset.nav);
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
    else if (document.getElementById('screen-capture').classList.contains('active')) startCamera();
  });

  // ---------- INIT ----------
  Storage.init()
    .then(() => {
      renderMain();
      showScreen('main');
    })
    .catch(err => {
      console.error('Storage init failed', err);
      $('main-event-name').textContent = "Storage unavailable — try a different browser or turn off private browsing.";
      showScreen('main');
    });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(registration => {
          function showUpdateBanner(worker) {
            $('update-banner').classList.remove('hidden');
            $('update-banner-btn').onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
          }

          if (registration.waiting && navigator.serviceWorker.controller) {
            showUpdateBanner(registration.waiting);
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateBanner(newWorker);
              }
            });
          });
        })
        .catch(err => console.error('SW registration failed', err));

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
    });
  }
})();
