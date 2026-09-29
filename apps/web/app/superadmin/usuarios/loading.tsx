import { SkeletonCard, SkeletonTable, SkeletonTitulo } from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando usuarios">
      <SkeletonTitulo />
      <SkeletonCard className="h-14" />
      <SkeletonCard className="h-12" />
      <SkeletonTable rows={8} />
    </div>
  );
}
