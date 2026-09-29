import { SkeletonCard, SkeletonTitulo } from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando organizaciones">
      <SkeletonTitulo />
      <SkeletonCard className="h-14" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard className="h-44" />
        <SkeletonCard className="h-44" />
        <SkeletonCard className="h-44" />
        <SkeletonCard className="h-44" />
      </div>
    </div>
  );
}
