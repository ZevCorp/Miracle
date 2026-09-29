import {
  SkeletonCard,
  SkeletonTable,
  SkeletonTileRow,
  SkeletonTitulo,
} from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando la analítica">
      <SkeletonTitulo />
      <SkeletonTileRow />
      <SkeletonTable rows={8} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-56" />
      </div>
    </div>
  );
}
