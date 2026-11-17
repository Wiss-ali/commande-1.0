'use client';
// Partage d'un PDF (WhatsApp, e-mail…) par le menu de partage du téléphone ; à défaut, téléchargement.
import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { classeBouton } from './ui';

export function PartagerPdf({ adresse, nom, texte }: { adresse: string; nom: string; texte: string }) {
  const [enCours, setEnCours] = useState(false);
  async function partager() {
    setEnCours(true);
    try {
      const reponse = await fetch(adresse);
      if (!reponse.ok) throw new Error('pdf');
      const fichier = new File([await reponse.blob()], `${nom}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [fichier] })) await navigator.share({ files: [fichier], title: nom });
      else {
        const lien = document.createElement('a');
        lien.href = URL.createObjectURL(fichier);
        lien.download = fichier.name;
        lien.click();
        URL.revokeObjectURL(lien.href);
      }
    } catch {
      // Partage annulé par l'utilisateur, ou connexion coupée : rien à faire.
    } finally {
      setEnCours(false);
    }
  }
  return (
    <button type="button" onClick={partager} disabled={enCours} className={classeBouton.secondaire}>
      <Share2 aria-hidden className="size-4" />
      {texte}
    </button>
  );
}
