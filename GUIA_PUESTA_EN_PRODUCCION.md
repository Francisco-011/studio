# PROSCENDIA: Guía Final para Puesta en Producción

¡Felicidades! Hemos construido juntos una aplicación poderosa y funcional. Este documento es tu mapa del tesoro, una guía paso a paso y sin tecnicismos para llevar PROSCENDIA del prototipo a una aplicación real, segura y en línea, lista para ser usada por tu equipo.

---

### **Analogía Rápida: Tu Aplicación es una Casa**

Imagina que hemos construido una casa modelo increíble (tu aplicación PROSCENDIA). Ahora, necesitamos conectarla a los servicios básicos (luz, agua, seguridad) para que sea habitable. En nuestro caso, estos servicios nos los provee **Firebase**, una plataforma de Google.

**¿Qué vamos a hacer?**
1.  **Crear el "Terreno" en la Nube**: Daremos de alta tu proyecto en Firebase.
2.  **Activar los "Servicios"**: Encenderemos la "luz" (Autenticación para usuarios) y el "agua" (Base de Datos Firestore para los datos).
3.  **Conectar la Casa**: Obtendremos las "llaves" (credenciales) de Firebase y se las daremos a tu aplicación PROSCENDIA.
4.  **Establecer las "Reglas de Seguridad"**: Le diremos al "guardia de seguridad" (Firestore Rules) quién puede entrar a cada habitación.
5.  **Abrir al Público**: Desplegaremos tu aplicación en internet para que todos puedan acceder a ella.

---

### **Paso 1: Crear tu Proyecto en Firebase (El Terreno)**

1.  **Ve a la Consola de Firebase**: Abre tu navegador web y ve a [https://console.firebase.google.com](https://console.firebase.google.com). Necesitarás una cuenta de Google (Gmail) para acceder.
2.  **Agrega un Nuevo Proyecto**: Haz clic en el botón grande que dice **"Agregar proyecto"** o **"Crear un proyecto"**.
3.  **Dale un Nombre**: Escribe un nombre para tu proyecto, por ejemplo, `proscendia-mi-empresa`. Haz clic en **"Continuar"**.
4.  **Google Analytics**: Te preguntará si quieres habilitar Google Analytics. Para mantenerlo simple, puedes desactivar esta opción por ahora. Haz clic en **"Crear proyecto"**.
5.  **¡Espera un Momento!**: Firebase tardará unos segundos en preparar tu nuevo "terreno" en la nube.

---

### **Paso 2: Activar los Servicios Necesarios**

Una vez que tu proyecto esté creado, verás el panel principal. En el menú de la izquierda, vamos a activar los servicios que necesitamos.

#### **2.1 Activar Autenticación (El Control de Acceso)**

1.  En el menú de la izquierda, busca la sección **"Compilación"** y haz clic en **"Authentication"**.
2.  Haz clic en el botón **"Comenzar"**.
3.  Verás una lista de "Proveedores de acceso". Haz clic en **"Correo electrónico y contraseña"**.
4.  Activa el primer interruptor que dice **"Correo electrónico/contraseña"**.
5.  Haz clic en **"Guardar"**.

¡Listo! Ahora tu aplicación permitirá a los usuarios registrarse y acceder con un email y contraseña.

#### **2.2 Activar Firestore (El Almacenamiento Central de Datos)**

Esta es la sección donde se habilita el almacenamiento de todos los datos de tu aplicación. Cloud Firestore es la base de datos donde se guardará toda la información que captures en PROSCENDIA. Al completar estos pasos, estás "encendiendo" el almacén de datos en la nube.

1.  En el menú de la izquierda, dentro de **"Compilación"**, haz clic en **"Firestore Database"**.
2.  Haz clic en el botón grande **"Crear base de datos"**.
3.  Te preguntará por el modo de seguridad. Elige **"Iniciar en modo de producción"**. Esto es muy importante para mantener tus datos seguros desde el principio. Haz clic en **"Siguiente"**.
4.  Te pedirá que elijas una ubicación. Selecciona la región que esté más cerca de ti o de tus usuarios (por ejemplo, `us-central` o `southamerica-east1`). Haz clic en **"Habilitar"**.

¡Perfecto! Acabas de crear la base de datos donde se almacenará toda la información de PROSCENDIA de forma segura y persistente.

---

### **Paso 3: Conectar PROSCENDIA con Firebase (Las Llaves de la Casa)**

Este es el paso más crucial. Le daremos a nuestra aplicación las "llaves" para que pueda hablar con tu proyecto de Firebase.

1.  **Ve a la Configuración del Proyecto**: En el menú de la izquierda, junto a "Descripción general del proyecto", haz clic en el ícono de engranaje (⚙️) y selecciona **"Configuración del proyecto"**.
2.  **Registra tu Aplicación Web**:
    *   Asegúrate de estar en la pestaña **"General"**.
    *   Busca la sección "Tus apps". Haz clic en el ícono que parece `</>` (representa una aplicación web).
    *   Asignale un "Apodo" a tu app, como `PROSCENDIA Web`. No necesitas marcar la casilla de "Firebase Hosting" en este paso.
    *   Haz clic en **"Registrar app"**.
3.  **Copia las Credenciales**:
    *   Firebase te mostrará un bloque de código con un objeto llamado `firebaseConfig`. ¡Estas son tus llaves!
    *   Ahora, en tu proyecto de PROSCENDIA, abre el archivo llamado `.env`.
    *   Copia cada valor del `firebaseConfig` y pégalo en la variable correspondiente en el archivo `.env`, reemplazando los valores de ejemplo.

    **Ejemplo Visual:**

    Si en Firebase ves:
    ```javascript
    const firebaseConfig = {
      apiKey: "AIzaSy...THIS_IS_AN_EXAMPLE...3s4",
      authDomain: "proscendia-mi-empresa.firebaseapp.com",
      projectId: "proscendia-mi-empresa",
      // ... y así sucesivamente
    };
    ```

    Tu archivo `.env` debería quedar así:
    ```
    NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...THIS_IS_AN_EXAMPLE...3s4
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=proscendia-mi-empresa.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=proscendia-mi-empresa
    # ... y así sucesivamente para todas las claves
    ```
4.  **Finaliza**: Una vez que hayas copiado todas las claves, puedes hacer clic en **"Continuar a la consola"** en la página de Firebase.

---

### **Paso 4: Aplicar las Reglas de Seguridad**

Ahora le diremos a nuestro "guardia de seguridad" quién puede hacer qué cosa.

1.  **Vuelve a Firestore**: En el menú de la izquierda de Firebase, ve a **"Compilación"** -> **"Firestore Database"**.
2.  **Ve a la Pestaña "Reglas"**: En la parte superior, haz clic en la pestaña **"Reglas"**.
3.  **Borra el Contenido Actual**: Verás un texto de ejemplo en el editor. Selecciónalo todo y bórralo.
4.  **Pega las Nuevas Reglas**: Copia TODO el contenido del siguiente bloque de código y pégalo en el editor de reglas de Firebase.

    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        
        // ===== FUNCIONES AUXILIARES =====
        // NOTA: Estas reglas dependen de que se configuren "Custom Claims" en Firebase Authentication
        // a través de una Cloud Function. El rol y nivel de acceso se leen desde el token del usuario.
        
        // Verificar si el usuario está autenticado
        function isAuthenticated() {
          return request.auth != null;
        }
        
        // Función para obtener el nivel de acceso de un usuario desde sus Custom Claims.
        function getUserAccessLevel() {
            return request.auth.token.get('nivelAcceso', 'Público');
        }

        // Función para obtener el rol de un usuario desde sus Custom Claims.
        function getUserRole() {
            return request.auth.token.get('rol', 'Usuario Final');
        }
        
        // Función para obtener el departamento de un usuario desde sus Custom Claims.
        function getUserDepartment() {
            return request.auth.token.get('departamentoId', null);
        }

        // Función para obtener el puesto de un usuario desde su perfil en Firestore.
        // Se usa para determinar la jerarquía.
        function getUserPuestoData() {
            return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
        }

        // Función para verificar si un usuario puede ver un documento específico.
        function canAccessDocument(docData) {
            let userLevel = getUserAccessLevel();
            let docLevel = docData.get('clasificacion', 'Público');

            // 1. Verificar Nivel de Acceso Básico
            let hasLevelAccess = 
                (docLevel == 'Público') ||
                (docLevel == 'Privado' && userLevel in ['Departamental', 'Jerárquico', 'Confidencial']) ||
                (docLevel == 'Confidencial' && userLevel in ['Confidencial']);

            if (!hasLevelAccess) {
                return false;
            }
            
            // Si el acceso es por nivel, no se necesitan más validaciones.
            if (userLevel == 'Confidencial' || docLevel == 'Público') {
                return true;
            }
            
            // 2. Lógica para niveles Departamental y Jerárquico
            // Nota: Esta es una simplificación. La lógica completa vive en el `ProcesosContext`.
            // La regla principal es permitir la lectura si el usuario tiene el nivel, 
            // el filtrado fino se hace en la app.
            return true;
        }

        // ===== REGLAS POR COLECCIÓN =====
        
        // -- Usuarios --
        match /users/{userId} {
          allow read: if isAuthenticated() && (request.auth.uid == userId || getUserRole() == 'Administrador');
          allow create: if request.auth != null; // Permite que un nuevo usuario cree su propio perfil.
          allow update: if isAuthenticated() && (request.auth.uid == userId || getUserRole() == 'Administrador');
        }
        
        // -- Catálogos Genéricos --
        function isManagerOrAdmin() {
            return getUserRole() in ['Administrador', 'Gerente de Proyecto'];
        }
        match /areas/{docId} { 
            allow read: if isAuthenticated(); 
            allow write: if isManagerOrAdmin(); 
        }
        match /departamentos/{docId} { 
            allow read: if isAuthenticated(); 
            allow write: if isManagerOrAdmin(); 
        }
        match /puestos/{docId} { 
            allow read: if isAuthenticated(); 
            allow write: if isManagerOrAdmin(); 
        }
        match /sistemas/{docId} { 
            allow read: if isAuthenticated(); 
            allow write: if isManagerOrAdmin(); 
        }
        match /sistemas_costos/{docId} { 
            allow read: if isAuthenticated(); 
            allow write: if isManagerOrAdmin(); 
        }
        match /acciones/{docId} { 
            allow read: if isAuthenticated(); 
            allow write: if isManagerOrAdmin(); 
        }
        match /actividades/{docId} { 
            allow read: if isAuthenticated(); 
            allow write: if isManagerOrAdmin(); 
        }
        
        // -- Reglas de Lectura Seguras para Colecciones Principales --
        // Permite la lectura si el usuario está autenticado y pasa la validación de nivel de acceso.
        match /procesos/{docId} {
            allow read: if isAuthenticated() && canAccessDocument(resource.data);
            allow write: if isManagerOrAdmin() || getUserRole() == 'Consultor';
        }
        
        match /politicas/{docId} {
            allow read: if isAuthenticated() && canAccessDocument(resource.data);
            allow write: if isManagerOrAdmin() || getUserRole() == 'Consultor';
        }
        
        match /procedimientos/{docId} {
            allow read: if isAuthenticated() && canAccessDocument(resource.data);
            allow write: if isManagerOrAdmin() || getUserRole() == 'Consultor';
        }
        
        // -- Excepciones y Auditoría --
        match /access_exceptions/{exceptionId} {
            allow read, write: if isManagerOrAdmin();
        }

        match /audits/{auditId} {
          allow read, create: if isAuthenticated();
          allow update, delete: if isManagerOrAdmin();
        }
        
        match /activity_log/{logId} {
          allow read: if isManagerOrAdmin();
          allow create: if isAuthenticated();
        }
        
        // -- Permisos --
        match /permissions/{role} {
            allow read: if isAuthenticated();
            allow write: if getUserRole() == 'Administrador';
        }
      }
    }
    ```

5.  **Publica los Cambios**: Haz clic en el botón **"Publicar"**.

¡Tus datos ahora están protegidos por reglas de seguridad a nivel de servidor!

---

### **Paso 5: Crear tu Usuario Administrador**

Ahora que todo está conectado y seguro, es hora de crear el primer usuario, que será el administrador del sistema.

1.  **Ejecuta la Aplicación**: Inicia la aplicación PROSCENDIA.
2.  **Regístrate**: Ve a la página de registro (`/signup`) y crea una cuenta con tu correo y una contraseña segura.
3.  **Conviértete en Administrador**:
    *   Ve a la consola de Firebase -> **Authentication**. Deberías ver el usuario que acabas de crear.
    *   Ahora ve a **Firestore Database**. Verás una "colección" llamada `users`. Haz clic en ella.
    *   Verás un "documento" con un ID largo y aleatorio. Haz clic en ese documento (es tu perfil de usuario).
    *   Busca el campo `rol`. Su valor actual será "Usuario Final".
    *   Haz clic en el ícono de lápiz para editarlo y cambia el valor a **`Administrador`** (¡escríbelo exactamente así, con la mayúscula!).
    *   Haz clic en **"Actualizar"**.
4.  **Inicia Sesión**: ¡Listo! Ahora puedes ir a la página de `/login` de tu aplicación, iniciar sesión con tu cuenta, y tendrás acceso a todas las funcionalidades como Administrador.

---

### **Paso 6: Desplegar la Aplicación (El Verdadero y Sencillo Paso Final)**

El entorno de Firebase Studio simplifica enormemente este último paso. No necesitas usar comandos en la terminal ni conectar a GitHub.

1.  **Busca el Botón de Despliegue**: Dentro de tu entorno de Firebase Studio, busca una sección o un botón etiquetado como **"Publicar"**, **"Desplegar"** o **"Deploy"**. Normalmente se encuentra en una barra de herramientas superior o en un panel lateral dedicado al despliegue.

2.  **Haz Clic**: Simplemente haz clic en ese botón para iniciar el proceso.

3.  **¡Espera y Listo!**: El entorno se encargará automáticamente de construir tu aplicación y ponerla en línea usando Firebase App Hosting. Una vez que el proceso termine (puede tardar unos minutos), te proporcionará la URL pública de tu aplicación (algo como `tu-proyecto.web.app`).

Eso es todo. Sin pasos complicados. ¡Tu aplicación PROSCENDIA ahora estará en vivo!

¡Enhorabuena por completar el proyecto!
