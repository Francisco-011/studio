import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, TrendingUp, CheckCircle2, Factory } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-bold mb-8 text-primary">Dashboard Ejecutivo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Procesos Mapeados</CardTitle>
            <Factory className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">152</div>
            <p className="text-xs text-muted-foreground">+5 desde el último mes</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duplicidades Detectadas</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground text-destructive">-2 identificadas esta semana</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ahorro Potencial</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18%</div>
            <p className="text-xs text-muted-foreground">Estimado $12,500 USD/mes</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acciones Completadas</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">+8 este trimestre</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle>Evolución de Optimización de Procesos</CardTitle>
            <CardDescription>Seguimiento mensual de métricas clave.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
             {/* Placeholder for chart */}
            <BarChart3 className="w-24 h-24 text-muted-foreground" />
            <p className="text-muted-foreground ml-4">Gráfico de evolución de procesos (Próximamente)</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Costos de Sistemas</CardTitle>
            <CardDescription>Resumen de costos e impacto.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm">
                  <p>Costo Total Mensual:</p>
                  <p className="font-semibold">$8,250 USD</p>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <p>Total Licencias:</p>
                  <p>320</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <p>Costo por Usuario:</p>
                  <p className="font-semibold">$25.78 USD</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <p>Ahorro Acumulado:</p>
                  <p className="font-semibold text-green-600">$3,500 USD</p>
                </div>
                <p className="text-xs text-muted-foreground">Por acciones completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
