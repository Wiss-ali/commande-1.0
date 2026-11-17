// Montant écrit en toutes lettres, en français et en arabe : exigé sur la facture (total TTC en chiffres et en lettres).

const UNITES_FR = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINES_FR = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

/** 0 à 99. `final` : le nombre termine le mot (« quatre-vingts » prend alors un s). */
function moinsDeCentFr(n: number, final: boolean): string {
  if (n < 20) return UNITES_FR[n]!;
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7 || d === 9) {
    const reste = 10 + u;
    return `${DIZAINES_FR[d]}${d === 7 && reste === 11 ? ' et ' : '-'}${UNITES_FR[reste]}`;
  }
  if (u === 0) return d === 8 && final ? 'quatre-vingts' : DIZAINES_FR[d]!;
  if (u === 1 && d !== 8) return `${DIZAINES_FR[d]} et un`;
  return `${DIZAINES_FR[d]}-${UNITES_FR[u]}`;
}

function moinsDeMilleFr(n: number, final: boolean): string {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  if (c === 0) return moinsDeCentFr(reste, final);
  const cent = c === 1 ? 'cent' : `${UNITES_FR[c]} cent${reste === 0 && final ? 's' : ''}`;
  return reste === 0 ? cent : `${cent} ${moinsDeCentFr(reste, final)}`;
}

export function nombreEnLettresFr(n: number): string {
  if (n === 0) return 'zéro';
  const morceaux: string[] = [];
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1000;
  if (milliards) morceaux.push(`${moinsDeMilleFr(milliards, true)} milliard${milliards > 1 ? 's' : ''}`);
  if (millions) morceaux.push(`${moinsDeMilleFr(millions, true)} million${millions > 1 ? 's' : ''}`);
  // « mille » est invariable, et on ne dit pas « un mille ». Devant « mille », cent et vingt ne prennent pas de s.
  if (milliers) morceaux.push(milliers === 1 ? 'mille' : `${moinsDeMilleFr(milliers, false)} mille`);
  if (reste) morceaux.push(moinsDeMilleFr(reste, true));
  return morceaux.join(' ');
}

const UNITES_AR = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const DIZAINES_AR = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const CENTAINES_AR = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function moinsDeMilleAr(n: number): string {
  const morceaux: string[] = [];
  const c = Math.floor(n / 100);
  const reste = n % 100;
  if (c) morceaux.push(CENTAINES_AR[c]!);
  if (reste) {
    if (reste < 20) morceaux.push(UNITES_AR[reste]!);
    else {
      const u = reste % 10;
      morceaux.push(u ? `${UNITES_AR[u]} و${DIZAINES_AR[Math.floor(reste / 10)]}` : DIZAINES_AR[Math.floor(reste / 10)]!);
    }
  }
  return morceaux.join(' و');
}

/** Groupe de milliers en arabe : singulier, duel, pluriel de 3 à 10, puis singulier au-delà. */
function groupeAr(n: number, un: string, deux: string, pluriel: string): string {
  if (n === 1) return un;
  if (n === 2) return deux;
  return `${moinsDeMilleAr(n)} ${n % 100 >= 3 && n % 100 <= 10 ? pluriel : un}`;
}

export function nombreEnLettresAr(n: number): string {
  if (n === 0) return 'صفر';
  const morceaux: string[] = [];
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1000;
  if (milliards) morceaux.push(groupeAr(milliards, 'مليار', 'ملياران', 'مليارات'));
  if (millions) morceaux.push(groupeAr(millions, 'مليون', 'مليونان', 'ملايين'));
  if (milliers) morceaux.push(groupeAr(milliers, 'ألف', 'ألفان', 'آلاف'));
  if (reste) morceaux.push(moinsDeMilleAr(reste));
  return morceaux.join(' و');
}

/** « Douze mille cinq cents dinars et cinquante centimes » / « اثنا عشر ألف وخمسمائة دينار جزائري ». */
export function montantEnLettres(centimes: number, langue: 'fr' | 'ar'): string {
  const abs = Math.abs(Math.trunc(centimes));
  const dinars = Math.floor(abs / 100);
  const reste = abs % 100;
  if (langue === 'ar') {
    const texte = `${nombreEnLettresAr(dinars)} دينار جزائري${reste ? ` و${nombreEnLettresAr(reste)} سنتيم` : ''}`;
    return centimes < 0 ? `ناقص ${texte}` : texte;
  }
  const texte = `${nombreEnLettresFr(dinars)} dinar${dinars > 1 ? 's' : ''}${reste ? ` et ${nombreEnLettresFr(reste)} centime${reste > 1 ? 's' : ''}` : ''}`;
  const phrase = centimes < 0 ? `moins ${texte}` : texte;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
