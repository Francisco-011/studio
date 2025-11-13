
'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResumenDashboardPage from '@/components/dashboards/ResumenDashboard';
import ProcesosDashboardPage from '@/components/dashboards/ProcesosDashboard';
import MejorasDashboardPage from '@/components/dashboards/MejorasDashboard';
import SistemasDashboardPage from '@/components/dashboards/SistemasDashboard';
import PoliticasDashboardPage from '@/components/dashboards/PoliticasDashboard';
import AuditoriaDashboardPage from '@/components/dashboards/AuditoriaDashboard';
import { useCallback } from 'react';

export default function DashboardPageContainer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'resumen';

  const handleTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', value);
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  return (
    <Tabs value={view} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 h-auto">
        <TabsTrigger value="resumen" className="h-12">Resumen Ejecutivo</TabsTrigger>
        <TabsTrigger value="procesos" className="h-12">Procesos y Eficiencia</TabsTrigger>
        <TabsTrigger value="mejoras" className="h-12">Impacto y Mejoras</TabsTrigger>
        <TabsTrigger value="sistemas" className="h-12">Sistemas y Costos</TabsTrigger>
        <TabsTrigger value="politicas" className="h-12">Políticas</TabsTrigger>
        <TabsTrigger value="auditoria" className="h-12">Auditoría</TabsTrigger>
      </TabsList>
      
      <TabsContent value="resumen" className="mt-4">
        <ResumenDashboardPage />
      </TabsContent>
      <TabsContent value="procesos" className="mt-4">
        <ProcesosDashboardPage />
      </TabsContent>
      <TabsContent value="mejoras" className="mt-4">
        <MejorasDashboardPage />
      </TabsContent>
       <TabsContent value="sistemas" className="mt-4">
        <SistemasDashboardPage />
      </TabsContent>
       <TabsContent value="politicas" className="mt-4">
        <PoliticasDashboardPage />
      </TabsContent>
       <TabsContent value="auditoria" className="mt-4">
        <AuditoriaDashboardPage />
      </TabsContent>
    </Tabs>
  );
}
