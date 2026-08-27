const Storage = (() => {
  const DB_NAME = 'meshmingle';
  const DB_VERSION = 1;
  const UNCATEGORIZED_ID = 'uncategorized';

  let db = null;
  const cache = {
    profile: null,
    events: [],
    activeEventId: null,
    contactsByEvent: {}
  };

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains('kv')) {
          database.createObjectStore('kv');
        }
        if (!database.objectStoreNames.contains('events')) {
          database.createObjectStore('events', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('contacts')) {
          const store = database.createObjectStore('contacts', { keyPath: 'id' });
          store.createIndex('eventId', 'eventId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function store(name, mode) {
    return db.transaction(name, mode).objectStore(name);
  }

  async function loadCache() {
    const kv = store('kv', 'readonly');
    cache.profile = (await reqToPromise(kv.get('profile'))) || null;
    cache.activeEventId = (await reqToPromise(kv.get('activeEventId'))) || null;

    cache.events = (await reqToPromise(store('events', 'readonly').getAll())) || [];

    const allContacts = (await reqToPromise(store('contacts', 'readonly').getAll())) || [];
    cache.contactsByEvent = {};
    allContacts.forEach(c => {
      if (!cache.contactsByEvent[c.eventId]) cache.contactsByEvent[c.eventId] = [];
      cache.contactsByEvent[c.eventId].push(c);
    });
    Object.values(cache.contactsByEvent).forEach(list =>
      list.sort((a, b) => (b.scannedAt || 0) - (a.scannedAt || 0))
    );

    if (cache.activeEventId && !cache.events.find(e => e.id === cache.activeEventId)) {
      cache.activeEventId = null;
    }
  }

  function requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }

  async function init() {
    db = await openDb();
    await loadCache();
    requestPersistentStorage();
  }

  function putKv(key, value) {
    store('kv', 'readwrite').put(value, key);
  }

  function getProfile() {
    return cache.profile;
  }

  function saveProfile(profile) {
    cache.profile = profile;
    putKv('profile', profile);
  }

  function hasProfile() {
    const p = cache.profile;
    return !!(p && p.name && p.name.trim());
  }

  function getEvents() {
    return cache.events;
  }

  function ensureUncategorizedEvent() {
    if (!cache.events.find(e => e.id === UNCATEGORIZED_ID)) {
      const evt = { id: UNCATEGORIZED_ID, name: 'Uncategorized', createdAt: Date.now() };
      cache.events.push(evt);
      store('events', 'readwrite').put(evt);
    }
    return UNCATEGORIZED_ID;
  }

  function createEvent(name) {
    const id = 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const evt = { id, name: name.trim(), createdAt: Date.now() };
    cache.events.push(evt);
    store('events', 'readwrite').put(evt);
    setActiveEventId(id);
    return id;
  }

  function getActiveEventId() {
    if (cache.activeEventId && cache.events.find(e => e.id === cache.activeEventId)) {
      return cache.activeEventId;
    }
    return null;
  }

  function setActiveEventId(id) {
    cache.activeEventId = id || null;
    putKv('activeEventId', cache.activeEventId);
  }

  function getEventById(id) {
    return cache.events.find(e => e.id === id) || null;
  }

  function getContacts(eventId) {
    return cache.contactsByEvent[eventId] || [];
  }

  function addContact(eventId, contact) {
    const record = { ...contact, eventId };
    if (!cache.contactsByEvent[eventId]) cache.contactsByEvent[eventId] = [];
    cache.contactsByEvent[eventId].unshift(record);
    store('contacts', 'readwrite').put(record);
  }

  return {
    UNCATEGORIZED_ID,
    init,
    getProfile,
    saveProfile,
    hasProfile,
    getEvents,
    ensureUncategorizedEvent,
    createEvent,
    getActiveEventId,
    setActiveEventId,
    getEventById,
    getContacts,
    addContact
  };
})();
