import {
  SkeletonCard,
  SkeletonChips,
  SkeletonTable,
  SkeletonTitulo,
} from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando consultas">
      <SkeletonTitulo />
      <SkeletonChips />
      <SkeletonCard className="h-12" />
      <SkeletonTable rows={10} />
    </div>
  );
}
