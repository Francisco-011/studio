# REGLAS TEMPORALES PARA CARGA DE DATOS DE PRUEBA

**¡IMPORTANTE!** Estas reglas de seguridad son **temporales y permisivas**. Están diseñadas exclusivamente para permitir que el script de "Cargar Datos de Prueba" funcione correctamente.

**Instrucciones:**
1.  **Copie y pegue TODO el contenido** de las reglas de abajo en la sección de Reglas de su base de datos de Firestore en la consola de Firebase.
2.  **Publique** los cambios.
3.  Vuelva a la aplicación y ejecute la función **"Cargar Datos de Prueba"** desde el módulo de Configuración.
4.  Una vez que la carga de datos haya finalizado exitosamente, **VUELVA A COPIAR las reglas originales** del archivo `GUIA_PUESTA_EN_PRODUCCION.md` y publíquelas para restaurar la seguridad del sistema.

---

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function to check if a user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to get user's data
    function getUserData(userId) {
      return get(/databases/$(database)/documents/users/$(userId)).data;
    }

    // --- USERS ---
    // Users can read their own data.
    // Admins can read anyone's data.
    // Users can only be created during signup.
    // Users can update their own data. Admins can update anyone's data.
    match /users/{userId} {
      allow read: if isAuthenticated() && (request.auth.uid == userId || getUserData(request.auth.uid).rol == 'Administrador');
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && (request.auth.uid == userId || getUserData(request.auth.uid).rol == 'Administrador');
    }

    // --- GENERIC CATALOGS & MAIN DATA (RELAXED WRITE RULES FOR SEEDING) ---
    // Any authenticated user can read AND write to these collections.
    match /areas/{docId} { allow read, write: if isAuthenticated(); }
    match /departamentos/{docId} { allow read, write: if isAuthenticated(); }
    match /puestos/{docId} { allow read, write: if isAuthenticated(); }
    match /sistemas/{docId} { allow read, write: if isAuthenticated(); }
    match /sistemas_costos/{docId} { allow read, write: if isAuthenticated(); }
    match /acciones/{docId} { allow read, write: if isAuthenticated(); }
    match /actividades/{docId} { allow read, write: if isAuthenticated(); }
    match /procedimientos/{docId} { allow read, write: if isAuthenticated(); }
    match /procesos/{processId} { allow read, write: if isAuthenticated(); }
    match /politicas/{policyId} { allow read, write: if isAuthenticated(); }
    
    // --- ACCESS EXCEPTIONS (Still requires high privilege) ---
    match /access_exceptions/{exceptionId} {
        allow read, write: if isAuthenticated() && getUserData(request.auth.uid).rol == 'Administrador';
    }

    // --- AUDITS AND LOGS (Relaxed for seeding) ---
    match /audits/{auditId} {
      allow read, write: if isAuthenticated();
    }
    
    match /activity_log/{logId} {
      allow read, write: if isAuthenticated();
    }
  }
}
```
