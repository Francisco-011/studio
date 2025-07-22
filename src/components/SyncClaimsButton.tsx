
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';

export function SyncClaimsButton() {
    const { isSyncing, lastSyncStatus, manualSync } = useAuth();

    const getTooltipContent = () => {
        if (isSyncing) return "Sincronizando permisos...";
        if (lastSyncStatus === 'sync') return "Sus permisos están sincronizados.";
        if (lastSyncStatus === 'mismatch') return "Hay un problema con sus permisos. Haga clic para corregir.";
        return "Estado de permisos desconocido.";
    };

    const getIcon = () => {
        if (isSyncing) return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
        if (lastSyncStatus === 'sync') return <ShieldCheck className="h-5 w-5 text-green-500" />;
        if (lastSyncStatus === 'mismatch') return <ShieldAlert className="h-5 w-5 text-destructive" />;
        return <ShieldAlert className="h-5 w-5 text-gray-400" />;
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={manualSync}
                        disabled={isSyncing}
                        className="h-8 w-8"
                    >
                        {getIcon()}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{getTooltipContent()}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
