import {
  SkeletonCard,
  SkeletonTileRow,
  SkeletonTitulo,
} from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando la salud del servicio">
      <SkeletonTitulo />
      <SkeletonTileRow />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-56" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
    </div>
  );
}
