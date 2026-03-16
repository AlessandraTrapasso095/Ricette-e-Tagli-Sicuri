import { dashboardNavigation } from "@/config/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { SideNav } from "@/components/layout/side-nav";

export function ReaderAreaNavCard() {
  return (
    <Card className="hidden p-3.5 lg:block lg:p-5">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Area lettori</CardTitle>
        <span className="text-[11px] font-medium uppercase tracking-wide text-rose-500 lg:hidden">Navigazione</span>
      </div>
      <div className="mt-3">
        <SideNav items={dashboardNavigation} mobileHorizontal />
      </div>
    </Card>
  );
}
