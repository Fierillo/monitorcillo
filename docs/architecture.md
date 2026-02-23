# Arquitectura del Sistema

El Monitorcillo está construido sobre **Next.js 15+ (App Router)** usando **TypeScript**.

## Filosofía Minimalista

1. **Cero Base de Datos Externa:** 
   No se utiliza PostgreSQL, MySQL ni MongoDB. Los datos curados se almacenan llanamente en `src/data/db.json`.
   Dado el bajo volumen de datos (unos pocos KB de texto histórico), Next.js puede leer este archivo a velocidad de disco/memoria en el servidor y renderizarlo estáticamente.
   
2. **Seguridad Sever-Side (Sin JWT complejo):**
   El panel de administración (`/admin`) no utiliza complejas librerías de sesión genéricas.
   Depende exclusivamente de validación de contraseña contra una variable de entorno (`ADMIN_PASSWORD`), guardando en el cliente una cookie encriptada de tipo `HttpOnly`. 
   Esto previene que cualquier JavaScript inyectado por XSS pueda robar la sesión.

3. **Sin Comentarios Inútiles:**
   El código fuente cumple un principio estricto de auto-explicación y variables declarativas, acompañado de retornos tempranos (`early returns`) para optimizar el AST y el flujo del V8 engine.

4. **Gráficos Livianos:**
   Se emplea `recharts` para dibujar historiales en SVG en lugar de pesados canvas de Chart.js u otras librerías mastodónticas.
