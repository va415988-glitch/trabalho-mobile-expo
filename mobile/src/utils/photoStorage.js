import * as FileSystem from 'expo-file-system';

function guessExtensionFromUri(uri) {
  const withoutQuery = uri.split('?')[0] || '';
  const match = withoutQuery.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() || 'jpg';
}

function isWeb() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function blobUriToDataUrl(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
}

export async function copyImageToAppStorage(uri) {
  if (!uri) return null;


  if (uri.startsWith('data:')) return uri;

 
  try {
    const ext = guessExtensionFromUri(uri);
    const filename = `photo_${Date.now()}.${ext}`;
    const destination = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.copyAsync({ from: uri, to: destination });
    return destination;
  } catch {
  
    if (isWeb() && (uri.startsWith('blob:') || uri.startsWith('content:') || uri.startsWith('http'))) {
      try {
        return await blobUriToDataUrl(uri);
      } catch {
       
      }
    }

    return uri;
  }
}
