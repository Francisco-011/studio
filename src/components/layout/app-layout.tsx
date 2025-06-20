
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
            <h1 className="text-3xl font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              STUFFACTORY
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-2 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} STUFFACTORY
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-auto flex-col items-start gap-2 border-b border-border bg-background px-4 pt-3 pb-2 sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pt-4 sm:pb-2">
          <div className="flex w-full items-center">
            <SidebarTrigger className="md:hidden mr-2" />
            <div className="flex flex-col flex-grow items-center">
              <h1 className="text-3xl font-bold text-primary">SIAP</h1>
              <p className="text-sm text-primary">
                Sistema Integral de Análisis de Procesos
              </p>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 pt-2 pb-4 sm:px-6 sm:py-0 md:gap-8">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
