import type { ReactNode } from 'react';

/** Corps d'un écran de l'espace commerçant : une colonne lisible sur téléphone, centrée sur grand écran. */
export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4">{children}</main>;
}
