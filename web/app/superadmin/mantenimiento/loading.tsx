import { SkeletonCard, SkeletonChips, SkeletonTitulo } from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonTitulo />
      <SkeletonCard className="h-24" />
      <SkeletonChips />
      <SkeletonCard className="h-80" />
      <SkeletonCard className="h-64" />
    </div>
  );
}
