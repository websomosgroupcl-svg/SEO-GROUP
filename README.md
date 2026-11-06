# SEOBESTIA

Aplicación privada para que un equipo siga el estado SEO y la visibilidad en IA de las webs que tiene autorizadas. Audita, investiga keywords, prepara encargos de contenido y mide el resultado de cada cambio. Las mejoras se aplican en el gestor de contenidos de cada web: SEOBESTIA no publica ni modifica nada.

## Funciones

- **Auditar:** rastreo y nota técnica, inspector de URLs, comparación entre rastreos, PageSpeed, indexación, sitemaps y etiquetas de Tag Manager.
- **Keywords:** consultas de Search Console o CSV, ideas long-tail y taller editorial.
- **Mejoras:** encargos para Google o IA, con registro de la URL y la fecha de publicación.
- **Medir:** evolución a 7, 28 o 90 días, visitas de GA4, intervenciones y visibilidad en IA.
- **Revisión diaria:** actualiza los datos de cada web y guarda los hallazgos con su evidencia.
- **Equipo:** cuentas con roles, varios administradores y sitios asignados por persona.

## Inicio rápido

Requiere Node 24.14 o superior.

```powershell
npm.cmd ci
npm.cmd start
```

Abre <http://127.0.0.1:4173> y entra con el usuario `admin` y la contraseña `admin`. Este acceso solo existe en la instalación local, que guarda sus datos en SQLite dentro de `.local`. Las revisiones programadas solo corren mientras el servidor está abierto.

| Comando | Uso |
|---|---|
| `npm.cmd start` | Inicia la aplicación |
| `npm.cmd test` | Ejecuta las pruebas |
| `npm.cmd run importar-geo -- "ruta del plan GEO"` | Importa fichas, preguntas, marcas y calibración; se puede repetir sin duplicar filas |
| `npm.cmd run backup -- save` | Crea una copia manual |
| `npm.cmd run backup -- restore AAAA-MM-DD --replace` | Reemplaza los datos del destino y cierra sesiones |

## Configuración

Copia `.env.example` a `.env`. Sin configuración, la aplicación funciona en local; cada integración se activa con su variable.

| Variable | Función |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` | Cuenta de servicio de Google, también configurable desde la aplicación |
| `GA4_SERVICE_ACCOUNT_JSON_BASE64` | Cuenta independiente para GA4 (opcional) |
| `PAGESPEED_API_KEY` | Medición de la página de inicio en móvil y escritorio |
| `OPENAI_API_KEY` | Panel automático de visibilidad en IA |
| `SEO_AI_PANEL_DAYS` | Días entre pasadas del panel; 7 por defecto |
| `GEMINI_API_KEY` | Clasificación de menciones en el panel |
| `SEO_OLLAMA_MODEL` | Modelo local de Ollama para ordenar hallazgos |

Las variables de alojamiento se detallan en [Despliegue](#despliegue).

## Conectar Google

Todo el acceso es de solo lectura.

1. Habilita en Google Cloud las API de Search Console, Analytics Admin, Analytics Data y Tag Manager.
2. Da permiso de lectura a la cuenta de servicio en cada propiedad y contenedor.
3. Abre una web, entra a **Conexiones de Google** y sube el JSON de la cuenta.

La aplicación revisa los accesos de la cuenta y vincula cada web por su dominio, sin reemplazar lo ya vinculado. Si das acceso a una propiedad nueva o agregas una web, pulsa **Revisar accesos de la cuenta**. Una web queda para vincular a mano en el paso **Vincular el sitio** cuando su dominio tiene varios flujos de GA4 o su propiedad usa otra variante de la URL.

GA4 requiere una web en la raíz del dominio con un único flujo identificable. Para vincular una propiedad a mano, el miembro debe tener la web asignada por un administrador.

## Visibilidad en IA

El panel automático se configura en **Medir → Configurar panel automático**. Consulta hasta 12 preguntas por web mediante `gpt-5.4-nano` con búsqueda web, a un costo cercano a 0,013 USD por pregunta. Conviene usar saldo prepagado sin recarga automática y solo preguntas públicas.

La aplicación informa la frecuencia de mención y de cita con su rango de confianza, por motor y tipo de pregunta. No calcula una posición ni un índice global, y solo declara un cambio cuando la muestra lo sostiene. Las respuestas de la API y la calibración tomada de las aplicaciones reales se guardan como series separadas. El detalle está en la [metodología](docs/METODOLOGIA.md).

## Despliegue

La versión para el equipo usa Netlify y PostgreSQL en Neon.

1. Crea la base PostgreSQL con TLS y un bucket privado de Neon Object Storage para los respaldos.
2. Configura en Netlify Node 24, el directorio publicado `public` y las funciones de `netlify/functions`.
3. Define estos secretos de ejecución:

   | Variable | Función |
   |---|---|
   | `DATABASE_URL` | Conexión a PostgreSQL |
   | `SEO_ADMIN_EMAIL`, `SEO_ADMIN_PASSWORD`, `SEO_ADMIN_NAME` | Primer administrador |
   | `SEO_WORKER_TOKEN` | Autenticación del trabajador; 32 caracteres o más |
   | `SEO_GOOGLE_VAULT_KEY` | Cifrado de las credenciales de Google; 32 bytes aleatorios en base64 o hexadecimal |
   | `SEO_BACKUP_KEY` | Cifrado de los respaldos; 32 caracteres o más y distinta de las demás |
   | `SEO_S3_ENDPOINT`, `SEO_S3_BUCKET`, `SEO_S3_ACCESS_KEY_ID`, `SEO_S3_SECRET_ACCESS_KEY`, `SEO_S3_REGION` | Bucket de respaldos |

4. Publica, entra con el administrador inicial y comprueba que `tick` está programado y que `review-background` recibe trabajos.

El proceso programado corre al minuto 17 de cada hora UTC y reserva una revisión diaria por web según la fecha de `America/Santiago`.

## Respaldos

Se crea una copia cifrada diaria cuando hay sitios reales: en `.local/backups` en local y en el bucket privado en el alojamiento. Se conservan siete copias diarias y hasta cuatro semanales.

Los respaldos no incluyen las credenciales de Google. Tras restaurar en otro proyecto, configura su propia clave de cifrado y vuelve a subir el JSON de cada cuenta. Guarda las claves fuera del proveedor y prueba cada restauración en una base separada.

## Límites del piloto

- El alojamiento admite hasta tres webs; la instalación local admite más.
- Cada web admite hasta tres revisiones manuales adicionales por día.
- Las importaciones CSV admiten hasta 5.000 filas o 1,5 MB, con un tope de 50.000 observaciones por web.
- La auditoría evalúa el HTML que entrega el servidor, sin ejecutar JavaScript.
- Falta validar el despliegue publicado: permisos reales de Google, restauración desde el bucket y dos ciclos diarios sin intervención.

## Documentación

- [Metodología de medición](docs/METODOLOGIA.md)
- [Decisiones de arquitectura](docs/DECISIONES.md)
- [Validación del almacenamiento](docs/VALIDACION_ALMACEN.md)
- [Propuesta del piloto](docs/PROPUESTA_PILOTO.md)
- [Viabilidad y arquitectura gratuita](docs/VIABILIDAD_Y_ARQUITECTURA_GRATUITA.md)

Los sprites de la mascota son [Pet Cats Pack](https://luizmelo.itch.io/pet-cat-pack), de LuizMelo, con licencia CC0.

## Licencia

[MIT](LICENSE)
