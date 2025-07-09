# REGLAS TEMPORALES PARA CARGA DE DATOS DE PRUEBA (VERSIÓN ABIERTA)

**¡ADVERTENCIA DE SEGURIDAD MUY IMPORTANTE!**

Estas reglas de seguridad son **extremadamente permisivas y abren completamente tu base de datos**, permitiendo que CUALQUIERA pueda leer y escribir en ella. Están diseñadas **únicamente como último recurso** para garantizar que el script de "Cargar Datos de Prueba" funcione.

**Instrucciones:**
1.  **Copie y pegue TODO el contenido** de las reglas de abajo en la sección de Reglas de su base de datos de Firestore.
2.  **Publique** los cambios.
3.  Vuelva a la aplicación y ejecute la función **"Cargar Datos de Prueba"**.
4.  **INMEDIATAMENTE DESPUÉS** de que la carga de datos finalice, **VUELVA A COPIAR las reglas originales y seguras** del archivo `GUIA_PUESTA_EN_PRODUCCION.md` y publíquelas para restaurar la seguridad del sistema. No deje la base de datos en este estado vulnerable.

---

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Estas reglas permiten el acceso de lectura y escritura a CUALQUIER
    // documento en su base de datos, sin requerir autenticación.
    // Use esto únicamente para la carga de datos inicial y luego reviértalo.
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
