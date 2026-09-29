import {
  SkeletonCard,
  SkeletonTable,
  SkeletonTileRow,
  SkeletonTitulo,
} from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando el resumen">
      <SkeletonTitulo />
      <SkeletonTileRow />
      <div className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
        <SkeletonCard className="h-72" />
        <SkeletonCard className="h-72" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-56" />
      </div>
      <SkeletonTable rows={4} />
    </div>
  );
}
