
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Card className="shadow-lg w-full">
        <CardHeader>
            <div className="flex items-center gap-2 mb-1">
                <LayoutDashboard className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-headline">Dashboards</CardTitle>
            </div>
            <CardDescription>
                Análisis y visualización de los indicadores clave de rendimiento (KPIs) de la organización.
            </CardDescription>
        </CardHeader>
        <CardContent>
            {children}
        </CardContent>
    </Card>
  );
}
