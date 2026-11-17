// Notifications sur le téléphone (Web Push), sans dépendance : chiffrement du message (RFC 8291, aes128gcm)
// et signature du serveur (VAPID, RFC 8292), avec le module « crypto » de Node.
// Sécurité : l'adresse d'envoi vient du navigateur ; elle n'est acceptée que chez les services de notification
// connus (sinon le serveur pourrait être poussé à appeler n'importe quelle adresse).
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign, type ECDH } from 'node:crypto';

export interface AbonnementNavigateur {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url');
const deB64u = (s: string) => Buffer.from(s, 'base64url');
const hmac = (cle: Buffer, ...donnees: Buffer[]) => createHmac('sha256', cle).update(Buffer.concat(donnees)).digest();

/** Services de notification des navigateurs (Chrome/Android, Firefox, Safari/iPhone, Edge/Windows). */
const HOTES = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^(?:[a-z0-9-]+\.)*push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];

export function adresseAutorisee(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && HOTES.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

export function abonnementValide(a: unknown): a is AbonnementNavigateur {
  if (!a || typeof a !== 'object') return false;
  const x = a as AbonnementNavigateur;
  return typeof x.endpoint === 'string' && x.endpoint.length <= 1000 && adresseAutorisee(x.endpoint)
    && typeof x.keys?.p256dh === 'string' && deB64u(x.keys.p256dh).length === 65
    && typeof x.keys?.auth === 'string' && deB64u(x.keys.auth).length === 16;
}

/** Chiffre le message pour le navigateur (un seul enregistrement, RFC 8291 § 3 et RFC 8188). */
export function chiffrerMessage(a: AbonnementNavigateur, message: string, sel = randomBytes(16), cleServeur?: ECDH): Buffer {
  const ephemere = cleServeur ?? createECDH('prime256v1');
  if (!cleServeur) ephemere.generateKeys();
  const publiqueNavigateur = deB64u(a.keys.p256dh);
  const secretAuth = deB64u(a.keys.auth);
  const publiqueServeur = ephemere.getPublicKey();
  const partage = ephemere.computeSecret(publiqueNavigateur);
  // IKM = HKDF(auth, partage, "WebPush: info" ‖ 0 ‖ clé navigateur ‖ clé serveur, 32)
  const prkCle = hmac(secretAuth, partage);
  const ikm = hmac(prkCle, Buffer.from('WebPush: info\0'), publiqueNavigateur, publiqueServeur, Buffer.from([1]));
  const prk = hmac(sel, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])).subarray(0, 12);
  const chiffreur = createCipheriv('aes-128-gcm', cek, nonce);
  // Délimiteur 0x02 : dernier (et seul) enregistrement, sans remplissage.
  const corps = Buffer.concat([chiffreur.update(Buffer.concat([Buffer.from(message, 'utf8'), Buffer.from([2])])), chiffreur.final(), chiffreur.getAuthTag()]);
  const entete = Buffer.alloc(21);
  sel.copy(entete, 0);
  entete.writeUInt32BE(4096, 16);
  entete.writeUInt8(publiqueServeur.length, 20);
  return Buffer.concat([entete, publiqueServeur, corps]);
}

/** Jeton VAPID signé (ES256) pour le service de notification visé. */
export function jetonVapid(endpoint: string, cles: { publique: string; privee: string; contact: string }, maintenant = Date.now()): string {
  const pub = deB64u(cles.publique);
  const cle = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: cles.privee, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  const entete = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corps = b64u(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(maintenant / 1000) + 12 * 3600, sub: cles.contact })));
  const signature = sign('sha256', Buffer.from(`${entete}.${corps}`), { key: cle, dsaEncoding: 'ieee-p1363' });
  return `${entete}.${corps}.${b64u(signature)}`;
}

/** Nouvelle paire de clés VAPID (à mettre dans les variables d'environnement, une fois pour toutes). */
export function creerClesVapid(): { publique: string; privee: string } {
  const e = createECDH('prime256v1');
  e.generateKeys();
  return { publique: b64u(e.getPublicKey()), privee: b64u(e.getPrivateKey()) };
}

export type ResultatEnvoi = 'envoye' | 'expire' | 'echec';

/** Envoie un message. « expire » : l'abonnement n'existe plus chez le service, à supprimer. */
export async function envoyerPush(a: AbonnementNavigateur, message: string, cles: { publique: string; privee: string; contact: string }): Promise<ResultatEnvoi> {
  if (!adresseAutorisee(a.endpoint)) return 'echec';
  try {
    const r = await fetch(a.endpoint, {
      method: 'POST',
      headers: {
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(24 * 3600),
        Urgency: 'high',
        Authorization: `vapid t=${jetonVapid(a.endpoint, cles)}, k=${cles.publique}`,
      },
      body: new Uint8Array(chiffrerMessage(a, message)),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (r.status === 404 || r.status === 410) return 'expire';
    return r.ok ? 'envoye' : 'echec';
  } catch {
    return 'echec';
  }
}
