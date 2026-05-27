import * as SQLite from 'expo-sqlite';

const hasSQLite = typeof SQLite?.openDatabaseSync === 'function';
const db = hasSQLite ? SQLite.openDatabaseSync('photos.db') : null;

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log(
    '[photosDb] expo-sqlite openDatabaseSync=',
    typeof SQLite?.openDatabaseSync,
    'hasSQLite=',
    hasSQLite,
    'db=',
    db ? 'READY' : 'NULL'
  );
}

const initSql = `
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    image_uri TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    created_at TEXT NOT NULL
  );
`;

const memoryStore = {
  photos: [],
  nextId: 1,
  loaded: false,
};

function toPhotoRow(row) {
  return {
    id: row.id,
    title: row.title,
    imageUri: row.image_uri,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
  };
}


const hasWebLocalStorage =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const WEB_STORAGE_KEY = 'photos_db_v1';

async function initPhotosTableMemory() {
  if (!hasWebLocalStorage) {
    memoryStore.loaded = true;
    return;
  }

  if (memoryStore.loaded) return;

  try {
    const raw = window.localStorage.getItem(WEB_STORAGE_KEY);
    if (!raw) {
      memoryStore.loaded = true;
      return;
    }

    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.photos)) memoryStore.photos = parsed.photos;
    if (parsed && typeof parsed.nextId === 'number') memoryStore.nextId = parsed.nextId;
  } catch {
   
  } finally {
    memoryStore.loaded = true;
  }
}

function writePhotosTableMemory() {
  if (!hasWebLocalStorage) return;

  try {
    window.localStorage.setItem(
      WEB_STORAGE_KEY,
      JSON.stringify({ photos: memoryStore.photos, nextId: memoryStore.nextId })
    );
  } catch {
   
  }
}

async function createPhotoMemory({ title, imageUri, latitude, longitude, createdAt }) {
  if (!memoryStore.loaded) await initPhotosTableMemory();

  const createdAtIso = createdAt ? String(createdAt) : new Date().toISOString();

  const row = {
    id: memoryStore.nextId,
    title,
    image_uri: imageUri,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    created_at: createdAtIso,
  };

  memoryStore.nextId += 1;
  memoryStore.photos.unshift(row);

  writePhotosTableMemory();

  return {
    id: row.id,
    title: row.title,
    imageUri: row.image_uri,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
  };
}

async function listPhotosMemory() {
  if (!memoryStore.loaded) await initPhotosTableMemory();

  return memoryStore.photos
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map(toPhotoRow);
}

async function deletePhotoMemory(id) {
  if (!memoryStore.loaded) await initPhotosTableMemory();

  const targetId = Number(id);
  const before = memoryStore.photos.length;

  memoryStore.photos = memoryStore.photos.filter((p) => p.id !== targetId);

  const removed = memoryStore.photos.length !== before;
  writePhotosTableMemory();

  return removed;
}

async function getPhotoByIdMemory(id) {
  if (!memoryStore.loaded) await initPhotosTableMemory();

  const target = memoryStore.photos.find((p) => p.id === Number(id));
  return target ? toPhotoRow(target) : null;
}


async function sqliteInit() {
  if (!db) return initPhotosTableMemory();
  await db.execAsync(initSql);
}

async function sqliteCreatePhoto({ title, imageUri, latitude, longitude, createdAt }) {
  await sqliteInit();

  const createdAtIso = createdAt ? String(createdAt) : new Date().toISOString();

  const statement = await db.prepareAsync(`
    INSERT INTO photos (title, image_uri, latitude, longitude, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  try {
    const result = await statement.executeAsync(
      title,
      imageUri,
      latitude ?? null,
      longitude ?? null,
      createdAtIso
    );

    return {
      id: result?.lastInsertRowId ?? null,
      title,
      imageUri,
      latitude,
      longitude,
      createdAt: createdAtIso,
    };
  } finally {
    await statement.finalizeAsync();
  }
}

async function sqliteListPhotos() {
  await sqliteInit();

  const statement = await db.prepareAsync(`
    SELECT id, title, image_uri, latitude, longitude, created_at
    FROM photos
    ORDER BY created_at DESC
  `);

  try {
    const result = await statement.executeAsync();
    const rows = await result.getAllAsync();
    return rows.map((r) => toPhotoRow(r));
  } finally {
    await statement.finalizeAsync();
  }
}

async function sqliteDeletePhoto(id) {
  await sqliteInit();

  const statement = await db.prepareAsync(`DELETE FROM photos WHERE id = ?`);
  try {
    const result = await statement.executeAsync(id);
    return result?.changes ?? 0;
  } finally {
    await statement.finalizeAsync();
  }
}

async function sqliteGetPhotoById(id) {
  await sqliteInit();

  const statement = await db.prepareAsync(`
    SELECT id, title, image_uri, latitude, longitude, created_at
    FROM photos
    WHERE id = ?
  `);

  try {
    const result = await statement.executeAsync(id);
    const row = await result.getFirstAsync();
    return row ? toPhotoRow(row) : null;
  } finally {
    await statement.finalizeAsync();
  }
}


export async function initPhotosTable() {
  if (!db) return initPhotosTableMemory();
  await sqliteInit();
}

export async function createPhoto({ title, imageUri, latitude, longitude, createdAt }) {
  if (!db) return createPhotoMemory({ title, imageUri, latitude, longitude, createdAt });
  return sqliteCreatePhoto({ title, imageUri, latitude, longitude, createdAt });
}

export async function listPhotos() {
  if (!db) return listPhotosMemory();
  return sqliteListPhotos();
}

export async function deletePhoto(id) {
  if (!db) return deletePhotoMemory(id);
  return sqliteDeletePhoto(id);
}

export async function getPhotoById(id) {
  if (!db) return getPhotoByIdMemory(id);
  return sqliteGetPhotoById(id);
}
