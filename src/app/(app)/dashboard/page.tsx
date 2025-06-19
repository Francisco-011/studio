
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, TrendingUp, CheckCircle2, Factory, DollarSign } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Dummy data for dashboard system costs - replace with dynamic data later
const exampleSystemCosts = [
  { id: '1', name: 'ERP Principal', annualUsage: 2400, annualNumLicenses: 10, annualCostPerLicense: 1500, currency: 'USD' },
  { id: '2', name: 'CRM Ventas', annualUsage: 600, annualNumLicenses: 5, annualCostPerLicense: 1000, currency: 'USD' },
  { id: '3', name: 'Software Contable', annualUsage: 0, annualNumLicenses: 2, annualCostPerLicense: 600, currency: 'MXN' },
  { id: '4', name: 'Herramienta BI', annualUsage: 1000, annualNumLicenses: 0, annualCostPerLicense: 0, currency: 'USD' },
];

function formatDashboardCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  } catch (e) {
    return `${amount.toFixed(0)} ${currency}`;
  }
}


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
            <BarChart3 className="w-24 h-24 text-muted-foreground" />
            <p className="text-muted-foreground ml-4">Gráfico de evolución de procesos (Próximamente)</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center gap-2">
             <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Costos de Sistemas</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">Resumen de costos anuales estimados por uso y licencias. (Datos de ejemplo)</CardDescription>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Sistema</TableHead>
                  <TableHead className="text-right">Uso Anual</TableHead>
                  <TableHead className="text-right">Licencias Anual</TableHead>
                  <TableHead className="text-right">Total Anual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exampleSystemCosts.map((cost) => {
                  const totalLicenseCost = (cost.annualNumLicenses || 0) * (cost.annualCostPerLicense || 0);
                  const totalAnnualCost = (cost.annualUsage || 0) + totalLicenseCost;
                  return (
                    <TableRow key={cost.id}>
                      <TableCell className="font-medium">{cost.name}</TableCell>
                      <TableCell className="text-right">{formatDashboardCurrency(cost.annualUsage || 0, cost.currency)}</TableCell>
                      <TableCell className="text-right">{formatDashboardCurrency(totalLicenseCost, cost.currency)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatDashboardCurrency(totalAnnualCost, cost.currency)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-6">
              <div className="flex justify-between text-sm">
                <p>Ahorro Acumulado:</p>
                <p className="font-semibold text-green-600">$3,500 USD</p>
              </div>
              <p className="text-xs text-muted-foreground">Por acciones de optimización completadas.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

