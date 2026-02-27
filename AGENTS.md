# Convenciones del Proyecto

## Commits

Los mensajes de commit deben seguir las convenciones de [Conventional Commits](https://www.conventionalcommits.org/) y estar **en inglés**.

### Tipos de commit

- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Cambios en documentación
- `style`: Cambios de formato (espacios, comas, etc. sin cambiar código)
- `refactor`: Refactorización del código
- `test`: Agregar o modificar tests
- `chore`: Tareas de mantenimiento (actualizar dependencias, caches, etc.)

### Formato

```
<type>: <descripción corta en imperativo>

[Cuerpo opcional con más detalles]
```

### Ejemplos

```bash
feat: add EMAE indicator with three series

fix: normalize black salary to base 100

chore: update BMA cache with latest data
```

## Separación de commits

- Cada funcionalidad/cambio lógico debe ir en un commit separado
- No agrupar cambios no relacionados
- Separar commits de features, fixes y tareas de mantenimiento

## Principio de commits atómicos

Los commits deben ser **cortos y enfocados**. Si necesitas escribir un mensaje de commit extenso para explicar todo lo que hace, probablemente deberías haber hecho commits más pequeños y específicos.

**Regla general**: Un commit = Una funcionalidad/cambio lógico

**Mal ejemplo**:
```
feat: add EMAE, update BMA cache, fix bug in chart, add new button
```

**Buenos ejemplos** (commits separados):
```
feat: add EMAE indicator with three series

chore: update BMA cache with recent data

fix: correct chart axis calculation

feat: add download button to chart view
```

## Idioma

- Commits: Inglés
- Código: Inglés
- Documentación: Español (para este proyecto)
