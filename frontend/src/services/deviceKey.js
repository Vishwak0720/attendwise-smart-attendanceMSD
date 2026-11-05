const databaseName = 'attendwise-device';
const storeName = 'keys';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeKeyPair(keyPair) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(keyPair, 'device-key');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function readKeyPair() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName).objectStore(storeName).get('device-key');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function base64Url(bytes) {
  let binary = '';
  new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function ecdsaRawToDer(rawSignature) {
  const bytes = new Uint8Array(rawSignature);
  const integer = (part) => {
    let start = 0;
    while (start < part.length - 1 && part[start] === 0) start += 1;
    const value = Array.from(part.slice(start));
    if (value[0] & 0x80) value.unshift(0);
    return [0x02, value.length, ...value];
  };
  const r = integer(bytes.slice(0, 32));
  const s = integer(bytes.slice(32, 64));
  const sequence = [...r, ...s];
  return new Uint8Array([0x30, sequence.length, ...sequence]);
}

export async function registerDeviceKey() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify']
  );
  const publicKey = base64Url(await crypto.subtle.exportKey('spki', keyPair.publicKey));
  await storeKeyPair(keyPair);
  return publicKey;
}

export async function signDeviceChallenge(challenge) {
  const keyPair = await readKeyPair();
  if (!keyPair) throw new Error('No registered device key is saved in this browser.');
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    new TextEncoder().encode(challenge)
  );
  return base64Url(ecdsaRawToDer(signature));
}
