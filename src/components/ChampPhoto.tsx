'use client';
// Photo d'un produit. L'image est réduite dans le téléphone avant l'envoi : quelques centaines de Ko
// au lieu de plusieurs Mo, ce qui compte sur une connexion lente. Le serveur la revérifie de toute façon.
import { Camera } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { classeBouton, Message } from './ui';

const COTE_MAX = 1200;

async function reduire(fichier: File): Promise<File> {
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const toile = document.createElement('canvas');
  toile.width = Math.round(image.width * echelle);
  toile.height = Math.round(image.height * echelle);
  toile.getContext('2d')?.drawImage(image, 0, 0, toile.width, toile.height);
  image.close();
  const blob = await new Promise<Blob | null>((fini) => toile.toBlob(fini, 'image/jpeg', 0.85));
  if (!blob) throw new Error('image');
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

export function ChampPhoto({ actuelle }: { actuelle: string | null }) {
  const t = useTranslations('produit');
  const envoi = useRef<HTMLInputElement>(null);
  const [apercu, setApercu] = useState<string | null>(actuelle);
  const [retiree, setRetiree] = useState(false);
  const [erreur, setErreur] = useState(false);

  async function choisir(fichier: File | undefined) {
    if (!fichier || !envoi.current) return;
    setErreur(false);
    try {
      const reduite = await reduire(fichier);
      const transfert = new DataTransfer();
      transfert.items.add(reduite);
      envoi.current.files = transfert.files;
      setApercu(URL.createObjectURL(reduite));
      setRetiree(false);
    } catch {
      setErreur(true);
    }
  }

  function retirer() {
    if (envoi.current) envoi.current.value = '';
    setApercu(null);
    setRetiree(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t('photo')}</span>
      <div className="flex items-center gap-3">
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-trait bg-creux text-doux">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {apercu ? <img src={apercu} alt="" className="size-full object-cover" /> : <Camera aria-hidden className="size-7" />}
        </span>
        <div className="flex flex-wrap gap-2">
          <label className={`${classeBouton.secondaire} cursor-pointer`}>
            {apercu ? t('photoChanger') : t('photoAjouter')}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void choisir(e.target.files?.[0])} />
          </label>
          {apercu ? <button type="button" onClick={retirer} className={classeBouton.secondaire}>{t('photoRetirer')}</button> : null}
        </div>
      </div>
      <input ref={envoi} type="file" name="photo" tabIndex={-1} aria-hidden className="hidden" />
      {retiree ? <input type="hidden" name="retirerPhoto" value="1" /> : null}
      {erreur ? <Message ton="erreur">{t('photoIllisible')}</Message> : null}
    </div>
  );
}
