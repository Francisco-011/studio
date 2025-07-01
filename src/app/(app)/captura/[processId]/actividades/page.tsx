
'use client';

// This page is now obsolete.
// The flow is now: Procesos -> Procedimientos -> Actividades.
// Navigation has been updated to reflect this, and this file can be safely removed.
export default function ObsoleteActivitiesPage() {
    if (typeof window !== 'undefined') {
        window.location.href = '/procesos-y-flujos-registrados';
    }
    return null;
}
