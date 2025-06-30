
'use client';

import { useRouter } from 'next/navigation';

// This page is now obsolete. The new flow is to define procedures for a process.
// Redirecting logic can be placed here or handled by removing links to this page.
export default function ObsoleteActivitiesPage() {
    const router = useRouter();
    // For now, just redirect to a safe place.
    // In a real app, you might check if the process exists and redirect to its new procedure page.
    if (typeof window !== 'undefined') {
        router.replace('/procesos-y-flujos-registrados');
    }
    return null;
}
