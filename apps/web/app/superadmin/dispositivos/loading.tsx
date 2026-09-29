import { SkeletonCard, SkeletonTileRow, SkeletonTitulo } from "@/components/superadmin/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonTitulo />
      <SkeletonTileRow />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
