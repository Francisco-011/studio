
'use client';

import { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertTriangle, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface ProblematicUser {
    uid: string;
    email: string;
    dbRole: string;
    tokenRole: string;
    dbVersion?: number;
    tokenVersion?: number;
}

interface DiagnosisResult {
    success: boolean;
    totalUsers: number;
    problematicUsers: number;
    users: ProblematicUser[];
}

const functions = getFunctions();
const diagnoseClaimsHealth = httpsCallable(functions, 'diagnoseClaimsHealth');
const syncUserClaims = httpsCallable(functions, 'setUserRole'); // Using setUserRole as a robust sync mechanism

export function ClaimsHealthDashboard() {
    const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const runDiagnosis = async () => {
        setIsLoading(true);
        try {
            const result = await diagnoseClaimsHealth();
            setDiagnosis(result.data as DiagnosisResult);
            setLastChecked(new Date());
        } catch (error: any) {
            console.error("Error running claims health diagnosis:", error);
            toast({
                title: 'Error de Diagnóstico',
                description: error.message || 'No se pudo completar el diagnóstico de permisos.',
                variant: 'destructive',
            });
            setDiagnosis(null);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFixUser = async (user: ProblematicUser) => {
        // Here we'd call a function to fix a specific user.
        // For now, we can re-run the diagnosis which might trigger auto-fixes or just refresh the state.
        toast({ title: 'Función no implementada', description: 'La corrección individual se implementará en una futura versión. Por ahora, los problemas se corrigen al iniciar sesión el usuario.'});
        // await runDiagnosis();
    };

    useEffect(() => {
        runDiagnosis();
    }, []);

    const getStatusVariant = (isHealthy: boolean): 'default' | 'destructive' | 'secondary' => {
        if (!diagnosis) return 'secondary';
        return isHealthy ? 'default' : 'destructive';
    }

    const getStatusIcon = (isHealthy: boolean) => {
        if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
        if (!diagnosis) return <AlertTriangle className="h-4 w-4 text-gray-400" />;
        return isHealthy ? <ShieldCheck className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-destructive" />;
    }

    const isHealthy = diagnosis ? diagnosis.problematicUsers === 0 : false;

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                         {getStatusIcon(isHealthy)}
                        <CardTitle>Salud de Permisos del Sistema</CardTitle>
                    </div>
                    <Button onClick={runDiagnosis} disabled={isLoading} variant="outline" size="sm">
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Volver a Analizar
                    </Button>
                </div>
                <CardDescription>
                    Diagnóstico del estado de sincronización de permisos entre la base de datos y los tokens de usuario.
                    {lastChecked && <span className="text-xs block mt-1">Última comprobación: {lastChecked.toLocaleTimeString()}</span>}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading && !diagnosis ? (
                    <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : diagnosis ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium text-muted-foreground">Total de Usuarios</p>
                                <p className="text-2xl font-bold">{diagnosis.totalUsers}</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium text-muted-foreground">Usuarios con Problemas</p>
                                <p className={`text-2xl font-bold ${diagnosis.problematicUsers > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                    {diagnosis.problematicUsers}
                                </p>
                            </div>
                             <div className="md:col-span-2 p-3 rounded-lg" style={{backgroundColor: isHealthy ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--destructive) / 0.1)'}}>
                                <p className="text-sm font-medium" style={{color: isHealthy ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}}>
                                    Estado del Sistema
                                </p>
                                <p className="text-2xl font-bold" style={{color: isHealthy ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}}>
                                    {isHealthy ? 'Sincronizado' : 'Requiere Atención'}
                                </p>
                            </div>
                        </div>

                        {diagnosis.users.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-md mb-2">Detalle de Usuarios con Problemas</h4>
                                <div className="rounded-md border max-h-60 overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Rol en DB</TableHead>
                                                <TableHead>Rol en Token</TableHead>
                                                <TableHead>Versión DB/Token</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {diagnosis.users.map(user => (
                                                <TableRow key={user.uid} className="bg-destructive/5 hover:bg-destructive/10">
                                                    <TableCell className="text-xs">{user.email}</TableCell>
                                                    <TableCell><Badge variant="secondary">{user.dbRole}</Badge></TableCell>
                                                    <TableCell><Badge variant="destructive">{user.tokenRole || 'N/A'}</Badge></TableCell>
                                                    <TableCell className="font-mono text-xs">
                                                        {user.dbVersion || 'N/A'} / {user.tokenVersion || 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground p-8">No se pudo obtener el diagnóstico.</p>
                )}
            </CardContent>
        </Card>
    );
}

