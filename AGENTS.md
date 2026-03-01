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

##ar commits de features Principio de commits atómicos

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

## Reglas de trabajo

- **NO hacer commits sin orden expresa del usuario**
- Esperar siempre la orden "commit" o "hacer commit" antes de ejecutar git commit

## Código

### Principios

**Código minimalista**: La mejor pieza de código es la que no existe. Menos código = menos bugs = más fácil de mantener.

**Sin comentarios**: El código debe ser autoexplicativo. Si necesitás comentarios, el código no está bien escrito.

**Mensajes de error claros**: Siempre que lances un error, explicá qué pasó y cómo arreglarlo.

**Nombres claros**: Usá nombres descriptivos para variables, funciones y clases. Evitá abreviaciones confusas.

**Funciones pequeñas**: Cada función debe hacer una sola cosa y hacerlo bien.

**Máximo 3 niveles de indentación**: Si necesitás más, refactorizá tu código.

**Returns tempranos**: Evitan procesar código innecesario.

**Async/await**: Priorizá el uso de async/await sobre callbacks. No teconfíes en callbacks que pueden llevar a callback hell.

### Ejemplos

```typescript
// Malo
function getUserData(userId: string, callback) {
    if (userId) {
        database.query('SELECT * FROM users WHERE id = ?', [userId], function(err, user) {
            if (err) {
                callback(err);
            } else {
                if (user) {
                    callback(null, user);
                } else {
                    callback(new Error('User not found'));
                }
            }
        });
    } else {
        callback(new Error('Invalid userId'));
    }
}

// Bueno
async function getUserData(userId: string): Promise<User> {
    if (!userId) throw new Error('Invalid userId');
    
    const user = await database.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) throw new Error('User not found');
    
    return user;
}
```

```typescript
// Malo - más de 3 niveles de indentación
function processData(data) {
    if (data) {
        if (data.items) {
            if (data.items.length > 0) {
                for (let i = 0; i < data.items.length; i++) {
                    if (data.items[i].valid) {
                        processItem(data.items[i]);
                    }
                }
            }
        }
    }
}

// Bueno - returns tempranos y menos niveles
function processData(data) {
    if (!data) return;
    if (!data.items?.length) return;
    
    for (const item of data.items) {
        if (item.valid) processItem(item);
    }
}
```
