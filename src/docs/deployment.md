# Ejecución y Despliegue

## Requisitos Previos

- `Node.js` v18+
- `pnpm` v9+

## Desarrollo Local

1. Instalar dependencias:
   ```bash
   pnpm install
   ```

2. Configurar variables de entorno:
    Crea un archivo `.env.local` en la raíz del proyecto:
    ```env
    ADMIN_PASSWORD=miContraseñaSecretaImperial123
    NEON_URL=postgresql://...
    ```
    Sin `ADMIN_PASSWORD`, el panel de administración queda bloqueado. Sin `NEON_URL`, la app no puede leer ni sincronizar datos.

3. Levantar el servidor de desarrollo:
   ```bash
   pnpm dev
   ```

## Panel de Administración

Para editar la base de datos visualmente sin tocar el JSON:
1. Ingresar a `http://localhost:3000/admin`.
2. Colocar la contraseña configurada en `ADMIN_PASSWORD`.
3. Modificar el JSON y guardar cambios.

## Sincronización Automática

El workflow de GitHub Actions corre `pnpm sync` cada 6 horas y ejecuta `runSync()` directamente contra Neon usando `secrets.NEON_URL`.

No existe un endpoint HTTP para disparar sincronizaciones. Las fuentes externas se consultan solo desde ese workflow programado.

## Construcción de Producción

Para optimizar y minificar todo antes de subir a un VPS, Vercel o Docker:

```bash
pnpm run build
pnpm run start
```

La tabla y componentes que dependen explícitamente de Node (Server Components) corren por defecto de forma dinámica o pre-renderizada estáticamente según la revalidación.
