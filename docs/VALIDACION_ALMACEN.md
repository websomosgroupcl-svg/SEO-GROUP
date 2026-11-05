# Validación del almacenamiento del piloto

4 de noviembre de 2026

Las seis pruebas de almacenamiento pasaron en Windows con Node 24.14. Una se ejecutó en PostgreSQL 18.6 real sobre la interfaz local del equipo y cinco en SQLite. El clúster temporal se inició con credenciales efímeras, creó un esquema exclusivo para la prueba y se detuvo al terminar.

## Qué se comprobó

- Dos conexiones PostgreSQL intentaron crear el primer administrador a la vez. Solo una pudo hacerlo. La otra conexión verificó una sesión emitida por la primera.
- Se guardaron 24 cambios concurrentes y un cambio posterior interrumpido antes de confirmar se revirtió. Modificar el resumen de una web conservó el cursor y sus 1.200 observaciones.
- Una copia cifrada de PostgreSQL permitió recuperar tres sitios tras vaciar la colección de prueba. La recuperación invalidó las sesiones previas.
- En SQLite se probó persistencia al reabrir el archivo, reversión de transacciones, permisos por sitio, limitación de intentos, recuperación de trabajos con un token vencido y rechazo de resultados tardíos.
- Una copia local alterada falló al verificar su integridad. La base mantuvo el estado anterior. Se probó la rotación de siete copias recientes y hasta cuatro semanales.

## Tamaño de las lecturas

El caso de prueba contiene tres webs, 1.200 consultas sintéticas por web y 24 trabajos. Las medidas indican bytes del JSON serializado en Node. El tráfico facturado por el proveedor y el espacio de tablas e índices requieren instrumentación en el despliegue.

| Operación | Bytes medidos |
|---|---:|
| Estado completo con el historial de tres sitios | 368.328 |
| Usuarios y sesiones después de la restauración | 297 |
| Resúmenes de los sitios y cola de trabajos | 703 |
| Ficha completa de un sitio, incluyendo sus observaciones | 122.547 |
| Copia comprimida y cifrada | 22.990 |

PostgreSQL conserva una fila de datos por sitio con una proyección pequeña para tarjetas y planificación. Los usuarios, las sesiones y los trabajos están separados del historial. Las transacciones solo escriben los registros que han cambiado. Al crecer el historial de una ficha crece también su coste de lectura y reescritura. Antes de aumentar los límites del piloto debe medirse con datos representativos y separar las observaciones históricas en tablas e índices si superan el presupuesto. La exportación de respaldo materializa el conjunto del piloto en memoria.

## Repetición y alcance

Ejecutar `node --test tests/store.test.mjs` para SQLite. Para PostgreSQL, establecer `SEO_TEST_POSTGRES` con una URL de prueba en localhost y ejecutar `node --test tests/store-postgres.test.mjs`. Esta última prueba crea y elimina su propio esquema. Si falta la variable, el resultado figura como omitido.

Quedan pendientes la conexión al proyecto real en Neon, la escritura y lectura con las credenciales del bucket privado, la medición del consumo mensual y la observación de dos ciclos diarios alojados. Para recuperar las copias hay que conservar por separado la clave. En el modo local se genera en `.local/.backup-key` por defecto. Los despliegues usan `SEO_BACKUP_KEY` configurada por el administrador.
