import { SkeletonCard, SkeletonTileRow, SkeletonTitulo } from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando el consumo de IA">
      <SkeletonTitulo />
      <SkeletonTileRow />
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonCard className="h-72" />
        <SkeletonCard className="h-72" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
    </div>
  );
}
