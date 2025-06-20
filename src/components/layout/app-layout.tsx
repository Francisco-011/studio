
import type { ReactNode } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { SidebarNav } from './sidebar-nav';
// Removed: import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            {/* Removed Building2 icon */}
            <h1 className="text-2xl font-headline font-semibold text-black group-data-[collapsible=icon]:hidden">
              STUFFACTRY
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-2 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} STUFFACTRY
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-auto flex-col items-start gap-2 border-b bg-background px-4 py-3 sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
          <div className="flex w-full items-center">
            <SidebarTrigger className="md:hidden mr-2" />
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold text-foreground">SIAP</h1>
              <p className="text-sm text-muted-foreground">
                Sistema Integral de Análisis de Procesos
              </p>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:px-6 sm:py-0 md:gap-8">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
