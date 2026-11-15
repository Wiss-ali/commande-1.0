// État de chargement : silhouettes grises à la place du contenu.
export default function Chargement() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4">
      <div className="h-16 animate-pulse rounded-xl bg-creux" />
      <div className="h-28 animate-pulse rounded-xl bg-creux" />
      <div className="h-14 animate-pulse rounded-xl bg-creux" />
      <div className="h-14 animate-pulse rounded-xl bg-creux" />
    </div>
  );
}
