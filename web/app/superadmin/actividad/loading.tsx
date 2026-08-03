import { SkeletonChips, SkeletonTable, SkeletonTitulo } from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonTitulo />
      <SkeletonChips />
      <SkeletonChips />
      <SkeletonTable rows={10} />
    </div>
  );
}
