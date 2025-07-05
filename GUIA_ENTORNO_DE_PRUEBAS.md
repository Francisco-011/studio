
# PROSCENDIA: Guía para Configurar un Entorno de Pruebas (Desarrollo)

## 1. Introducción: ¿Por qué tener dos entornos?

Imagina que tu aplicación PROSCENDIA es un restaurante. El **entorno de producción** es el restaurante abierto al público: todo debe funcionar a la perfección, los platos (datos) son reales y no puedes permitirte experimentar con la receta del día.

Un **entorno de desarrollo (o pruebas)** es tu cocina de pruebas privada. Aquí puedes experimentar con nuevos ingredientes (funcionalidades), probar nuevas recetas (flujos de trabajo), ensuciar todo lo que quieras y, si algo sale mal, simplemente lo limpias y empiezas de nuevo sin afectar a tus clientes.

**Beneficios Clave:**
- **Protección de Datos:** Tus datos reales y productivos nunca se ven comprometidos por pruebas.
- **Libertad para Experimentar:** Puedes probar nuevas funcionalidades, realizar cargas masivas de prueba o simular escenarios complejos sin miedo a romper algo importante.
- **Desarrollo Seguro:** Permite realizar cambios y actualizaciones en un entorno seguro antes de aplicarlos a la versión que utiliza toda la empresa.

---

## 2. Pasos para la Configuración

Esta guía te mostrará cómo crear esta "cocina de pruebas" utilizando un segundo proyecto de Firebase y un archivo especial llamado `.env.local`.

### **Paso 1: Crear tu Proyecto de Pruebas en Firebase**

1.  **Ve a la Consola de Firebase**: Abre tu navegador y ve a [https://console.firebase.google.com](https://console.firebase.google.com).
2.  **Agrega un Nuevo Proyecto**: Haz clic en **"Agregar proyecto"**.
3.  **Dale un Nombre Distintivo**: Es crucial que el nombre sea diferente al de producción. Por ejemplo, si tu proyecto principal es `proscendia-mi-empresa`, llama a este `proscendia-dev` o `proscendia-pruebas`.
4.  **Google Analytics**: Puedes desactivar esta opción para simplificar.
5.  **Crea el Proyecto**: Espera a que Firebase configure todo.

### **Paso 2: Activar los Servicios (Igual que en Producción)**

Una vez creado el proyecto de pruebas, debes activar los mismos servicios que en tu proyecto de producción.

1.  **Authentication**:
    *   Ve a **Compilación -> Authentication -> Comenzar**.
    *   Habilita el proveedor **"Correo electrónico y contraseña"**.

2.  **Firestore Database**:
    *   Ve a **Compilación -> Firestore Database -> Crear base de datos**.
    *   Selecciona **"Iniciar en modo de producción"**. ¡Esto es importante! Mantiene las reglas de seguridad.
    *   Elige la ubicación y haz clic en **"Habilitar"**.

### **Paso 3: Obtener las Credenciales del Entorno de Pruebas**

Ahora, obtendremos las "llaves" para tu cocina de pruebas.

1.  **Configuración del Proyecto**: En tu **nuevo** proyecto `proscendia-dev`, ve a **Configuración del proyecto** (el ícono ⚙️).
2.  **Registra una Aplicación Web**:
    *   En la pestaña "General", baja a "Tus apps" y haz clic en el ícono web `</>`.
    *   Dale un apodo, como `PROSCENDIA Dev Web`.
    *   Haz clic en **"Registrar app"**.
3.  **Copia las Credenciales de Prueba**:
    *   Firebase te mostrará el objeto `firebaseConfig`. ¡Estas son las llaves de tu entorno de desarrollo! Mantenlas a la mano.

### **Paso 4: Crear el Archivo `.env.local`**

Aquí está el paso clave que le dice a tu aplicación cuándo conectarse a la base de datos de pruebas.

1.  **Ve a tu Proyecto PROSCENDIA**: En la raíz de tu proyecto (al mismo nivel que el archivo `.env`), crea un nuevo archivo llamado exactamente:
    ```
    .env.local
    ```
    (El punto al principio es importante).

2.  **Copia la Estructura**: Abre tu archivo `.env` existente y copia todas las líneas (ej: `NEXT_PUBLIC_FIREBASE_API_KEY=...`).

3.  **Pega y Reemplaza**: Pega este contenido en tu nuevo archivo `.env.local`. Ahora, **reemplaza los valores** con las credenciales que obtuviste en el Paso 3 (las de tu proyecto `proscendia-dev`).

    **Ejemplo Visual:**

    Tu archivo `.env.local` debería verse así, pero con las credenciales de **DESARROLLO**:
    ```
    NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...CREDENCIAL_DE_PRUEBAS...
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=proscendia-dev.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=proscendia-dev
    # ... y así sucesivamente para todas las claves de tu proyecto de DESARROLLO
    ```

**¿Cómo funciona esta magia?**
Next.js (el framework de la aplicación) está configurado para que, cuando ejecutes la aplicación en tu computadora (`npm run dev`), siempre buscará y usará primero el archivo `.env.local`. Cuando la aplicación se despliega a producción, este archivo se ignora y se utiliza el `.env` principal.

### **Paso 5: Aplicar las Reglas de Seguridad en el Entorno de Pruebas**

No te olvides de este paso. Tu base de datos de pruebas también debe ser segura.

1.  **Ve a Firestore en `proscendia-dev`**: En la consola de Firebase de tu proyecto de desarrollo.
2.  **Pestaña "Reglas"**: Ve a la pestaña "Reglas".
3.  **Copia y Pega**: Copia las mismas reglas que tienes en tu archivo `firestore.rules` (o las que tienes publicadas en tu base de datos de producción) y pégalas aquí.
4.  **Publica** los cambios.

### **Paso 6: ¡A Probar!**

¡Eso es todo! Ahora, cada vez que ejecutes el comando `npm run dev` en tu terminal, la aplicación se conectará automáticamente a tu base de datos de pruebas (`proscendia-dev`). Puedes registrar usuarios de prueba, crear datos ficticios y hacer todos los cambios que necesites con la tranquilidad de que tu entorno de producción está seguro y sin alteraciones.
