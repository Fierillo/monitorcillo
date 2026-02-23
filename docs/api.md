# Endpoints de la API

El Monitorcillo cuenta con APIs minimalistas de sistema para validar sesiones y guardar/leer el archivo JSON central (`src/data/db.json`).

## GET `/api/data`
Retorna el JSON validado de todos los indicadores actuales.
Es público (Read-only).

## POST `/api/data`
Sobrescribe el archivo de la base de datos local con un JSON nuevo.
**Requiere Autorización.**
- Headers requeridos: Cookie que contenga `auth_token` válido.
- Body requerido: Array de objetos que conformen a la interfaz `Indicator`.

```typescript
export interface Indicator {
  id: string;
  fecha: string;
  fuente: string;
  indicador: string;
  referencia: string;
  dato: string;
  trend?: 'up' | 'down' | 'neutral';
}
```

## POST `/api/auth`
Recibe `{ "password": "tu-password" }`.
Si cumple con la condición en el servidor, devuelve una respuesta 200 asignando en un Header `Set-Cookie` cifrado y marcado como `HttpOnly`.

## DELETE `/api/auth`
Invalida y borra la cookie en el cliente devolviendo el usuario al estado deslogueado.
