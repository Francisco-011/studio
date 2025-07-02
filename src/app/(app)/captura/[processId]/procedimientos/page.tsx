'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Workflow } from 'lucide-react';
import Link from 'next/link';

export default function ObsoleteProcedimientosPage() {
    return (
        <div className="container mx-auto py-8">
            <Card className="max-w-2xl mx-auto text-center shadow-lg">
                <CardHeader>
                    <div className="mx-auto bg-amber-100 rounded-full h-16 w-16 flex items-center justify-center">
                        <Workflow className="h-8 w-8 text-amber-600" />
                    </div>
                    <CardTitle className="mt-4 text-2xl font-headline">Página Actualizada</CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription className="text-base text-foreground">
                        La gestión de procedimientos ha sido centralizada en su propio módulo para una mejor experiencia.
                    </CardDescription>
                    <p className="mt-4 text-sm text-muted-foreground">
                        Para agregar o editar procedimientos para este o cualquier otro proceso, por favor diríjase al nuevo módulo de "Procedimientos".
                    </p>
                    <div className="mt-6 flex justify-center gap-4">
                        <Button asChild>
                            <Link href="/procedimientos">Ir al Módulo de Procedimientos</Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/procesos-y-flujos-registrados">Volver a Procesos</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
