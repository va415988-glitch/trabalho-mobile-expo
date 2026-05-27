let lastCoords = null;

/**
 * @param {{ latitude: number; longitude: number } | null} coords
 */
export function setLastCoords(coords) {
  if (!coords) {
    lastCoords = null;
    return;
  }
  const { latitude, longitude } = coords;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
  lastCoords = { latitude, longitude };
}

export function getLastCoords() {
  return lastCoords ? { ...lastCoords } : null;
}

export function isValidCoords(coords) {
  if (!coords) return false;
  const { latitude, longitude } = coords;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}
