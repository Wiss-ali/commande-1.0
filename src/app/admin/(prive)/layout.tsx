import { LogOut } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { adminDeconnexion } from '@/app/actions/admin';
import { classeBouton } from '@/components/ui';
import { exigerAdmin } from '@/lib/web';

export default async function Admin({ children }: { children: React.ReactNode }) {
  const s = await exigerAdmin();
  const t = await getTranslations('admin');
  return (
    <div className="pb-10">
      {children}
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 pt-6">
        <span dir="ltr" className="truncate text-sm text-doux">{s.administrateur.identifiant}</span>
        <form action={adminDeconnexion}>
          <button type="submit" className={classeBouton.secondaire}>
            <LogOut aria-hidden className="directionnelle size-4" />
            {t('deconnexion')}
          </button>
        </form>
      </div>
    </div>
  );
}
