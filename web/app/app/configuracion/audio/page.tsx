import { MicrofonoSettings } from "./MicrofonoSettings";
import { OmiSettings } from "./OmiSettings";

export const metadata = { title: "Audio y dispositivos" };

export default function AudioPage() {
  return (
    <>
      <MicrofonoSettings />
      <OmiSettings />
    </>
  );
}
