import {
  SkeletonCard,
  SkeletonTable,
  SkeletonTileRow,
  SkeletonTitulo,
} from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando la organización">
      <SkeletonTitulo />
      <SkeletonTileRow />
      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <SkeletonCard className="h-56" />
        <SkeletonTable rows={5} />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}
