
'use client';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

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
            &copy; {new Date().getFullYear()} Francisco Rivera Almazán
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-auto flex-row items-center gap-2 border-b border-border bg-background px-4 pt-3 pb-2 sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pt-4 sm:pb-2">
          <div className="flex w-full items-center">
            <SidebarTrigger className="md:hidden mr-2" />
            <div className="flex flex-col flex-grow items-center">
              <h1 className="text-3xl font-bold text-primary">PROSCENDIA</h1>
              <p className="text-sm text-primary">
                Eleva tus Procesos
              </p>
            </div>
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(user?.nombreCompleto)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.nombreCompleto}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 px-4 pt-2 pb-4 sm:px-6 sm:py-0 md:gap-8">
          {children}
        </main>
        <footer className="px-4 py-2 text-center text-xs text-muted-foreground">
          © 2025 Francisco Rivera Almazán. Todos los derechos reservados.
        </footer>
      </SidebarInset>
    </>
  );
}
