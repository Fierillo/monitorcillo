# Interacciones y Navegación

El Monitorcillo ha sido diseñado para ser conciso y jerárquico.

## 1. Tabla Principal Base
Al ingresar a la página de inicio, el usuario solo verá la tabla resumen de indicadores con la estética imperial. El gráfico ya no se carga en el inicio para mejorar el enfoque y el rendimiento del renderizado base.

## 2. Navegación a Detalles ("Subdominios")
Los indicadores pueden tener asociado un booleano `hasDetails`.
Cuando un indicador en el administrador JSON tiene `hasDetails: true`:
- La fila en la tabla agrega un ícono "▼".
- La fila cambia su cursor a estilo `pointer` e ilumina sus bordes dorados en `hover`.
- Si el usuario hace click, la aplicación navega hacia `/indicador/[id]`.
- Esta nueva ruta dinámica (enfoque nativo Next.js en vez de verdaderos subdominios de DNS para ser minimalista) carga un entorno inmersivo dedicado a *ese único* indicador y dibuja los gráficos de evolución correspondientes.

Si por el contrario el indicador **no** tiene la bandera `hasDetails`, la fila de la tabla permanecerá estática y sin posibilidad de clicqueo (siguiendo estrictamente la directiva: "para los que no se pueda o sea complejo simplemente no lo hagas clickleable").
