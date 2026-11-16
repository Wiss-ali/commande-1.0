'use client';
// Scan des codes-barres par l'appareil photo, dans le navigateur.
// Lecteur natif du téléphone (BarcodeDetector) quand il existe ; sinon ZXing en WebAssembly
// (nécessaire sur iPhone), servi par l'application elle-même. Saisie manuelle toujours possible.
import { Flashlight, FlashlightOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { classeBouton, Message } from './ui';

type Lecteur = (video: HTMLVideoElement) => Promise<string | null>;
interface DetecteurNatif {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
interface ClasseDetecteur {
  new (options: { formats: string[] }): DetecteurNatif;
  getSupportedFormats(): Promise<string[]>;
}

const FORMATS_NATIFS = ['ean_13', 'ean_8', 'upc_a', 'code_128', 'qr_code'];

async function creerLecteur(): Promise<Lecteur> {
  const Natif = (window as unknown as { BarcodeDetector?: ClasseDetecteur }).BarcodeDetector;
  if (Natif) {
    try {
      const disponibles = await Natif.getSupportedFormats();
      const formats = FORMATS_NATIFS.filter((f) => disponibles.includes(f));
      if (formats.includes('ean_13')) {
        const detecteur = new Natif({ formats });
        return async (video) => (await detecteur.detect(video))[0]?.rawValue ?? null;
      }
    } catch {
      // On passe au lecteur de secours.
    }
  }
  const { prepareZXingModule, readBarcodes } = await import('zxing-wasm/reader');
  prepareZXingModule({ overrides: { locateFile: (chemin: string, prefixe: string) => (chemin.endsWith('.wasm') ? '/wasm/zxing_reader.wasm' : prefixe + chemin) } });
  const toile = document.createElement('canvas');
  const dessin = toile.getContext('2d', { willReadFrequently: true });
  if (!dessin) throw new Error('canvas');
  return async (video) => {
    const echelle = Math.min(1, 1024 / video.videoWidth);
    toile.width = Math.round(video.videoWidth * echelle);
    toile.height = Math.round(video.videoHeight * echelle);
    dessin.drawImage(video, 0, 0, toile.width, toile.height);
    const lus = await readBarcodes(dessin.getImageData(0, 0, toile.width, toile.height), { formats: ['EAN13', 'EAN8', 'UPCA', 'Code128', 'QRCode'], tryHarder: true, maxNumberOfSymbols: 1 });
    return lus.find((l) => l.isValid && l.text)?.text ?? null;
  };
}

let audio: AudioContext | undefined;
function signaler() {
  navigator.vibrate?.(80);
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const son = audio.createOscillator();
    const volume = audio.createGain();
    son.frequency.value = 1320;
    volume.gain.value = 0.08;
    son.connect(volume).connect(audio.destination);
    son.start();
    son.stop(audio.currentTime + 0.09);
  } catch {
    // Pas de son sur cet appareil : la vibration et l'écran suffisent.
  }
}

type EtatScan = 'demarrage' | 'actif' | 'refuse' | 'indisponible';

export function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const t = useTranslations('scan');
  const video = useRef<HTMLVideoElement>(null);
  const piste = useRef<MediaStreamTrack | null>(null);
  const rappel = useRef(onCode);
  const [etat, setEtat] = useState<EtatScan>('demarrage');
  const [lampe, setLampe] = useState<boolean | null>(null); // null : pas de lampe sur cet appareil
  const [saisie, setSaisie] = useState('');

  useEffect(() => {
    rappel.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let arrete = false;
    let flux: MediaStream | undefined;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const dernier = { code: '', quand: 0 };
    const eteindre = () => flux?.getTracks().forEach((p) => p.stop());

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setEtat('indisponible');
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e) {
        return setEtat(e instanceof DOMException && e.name === 'NotAllowedError' ? 'refuse' : 'indisponible');
      }
      const v = video.current;
      if (arrete || !v) return eteindre();
      v.srcObject = flux;
      await v.play().catch(() => undefined);
      piste.current = flux.getVideoTracks()[0] ?? null;
      const capacites = piste.current?.getCapabilities?.() as { torch?: boolean } | undefined;
      if (capacites?.torch) setLampe(false);
      let lire: Lecteur;
      try {
        lire = await creerLecteur();
      } catch {
        return setEtat('indisponible');
      }
      if (arrete) return;
      setEtat('actif');
      const tour = async () => {
        if (arrete) return;
        if (!document.hidden && v.readyState >= 2 && v.videoWidth > 0) {
          try {
            const code = await lire(v);
            const maintenant = Date.now();
            // Le même code n'est pas relu avant deux secondes : un article = un bip.
            if (code && !arrete && (code !== dernier.code || maintenant - dernier.quand > 2000)) {
              dernier.code = code;
              dernier.quand = maintenant;
              signaler();
              rappel.current(code);
            } else if (code) dernier.quand = maintenant;
          } catch {
            // Image illisible : on réessaie au tour suivant.
          }
        }
        minuteur = setTimeout(tour, 150);
      };
      void tour();
    })();

    return () => {
      arrete = true;
      clearTimeout(minuteur);
      eteindre();
    };
  }, []);

  async function basculerLampe() {
    const allumer = !lampe;
    try {
      await piste.current?.applyConstraints({ advanced: [{ torch: allumer } as MediaTrackConstraintSet] });
      setLampe(allumer);
    } catch {
      setLampe(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-encre">
        <video ref={video} playsInline muted className="size-full object-cover" />
        {etat === 'actif' ? <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-safran" /> : null}
        {etat === 'demarrage' ? <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white">{t('demarrage')}</p> : null}
        {lampe !== null ? (
          <button type="button" onClick={basculerLampe} aria-pressed={lampe} aria-label={t('lampe')} className="absolute end-3 top-3 inline-flex size-12 items-center justify-center rounded-full bg-surface text-encre">
            {lampe ? <FlashlightOff aria-hidden className="size-5" /> : <Flashlight aria-hidden className="size-5" />}
          </button>
        ) : null}
      </div>
      {etat === 'actif' ? <p className="text-center text-sm text-doux">{t('viser')}</p> : null}
      {etat === 'refuse' ? <Message ton="info">{t('refuse')}</Message> : null}
      {etat === 'indisponible' ? <Message ton="info">{t('indisponible')}</Message> : null}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const code = saisie.trim();
          if (!code) return;
          setSaisie('');
          rappel.current(code);
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">{t('saisieManuelle')}</span>
          <input value={saisie} onChange={(e) => setSaisie(e.target.value)} inputMode="text" autoComplete="off" dir="ltr" maxLength={64} className="min-h-12 w-full rounded-lg border border-trait bg-surface px-3 text-base text-encre" />
        </label>
        <button type="submit" className={`${classeBouton.secondaire} min-h-12`}>{t('valider')}</button>
      </form>
    </div>
  );
}
