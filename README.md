# SEOBESTIA

Aplicación privada para investigar keywords y long-tail, auditar webs autorizadas, preparar briefs y revisar cambios diariamente. El primer recorrido funciona con datos importados o con Search Console. El equipo aplica las mejoras en su gestor de contenidos.

## Abrir el piloto en este computador

Desde la carpeta del proyecto, con Node 24.14 o superior y npm:

~~~powershell
npm.cmd ci
npm.cmd start
~~~

Abre [SEOBESTIA local](http://127.0.0.1:4173). En este computador, la instalación con SQLite crea el usuario **admin** con la contraseña **admin**. En el sitio alojado, el administrador inicial puede entrar con su correo o con el alias **admin** y su contraseña privada. El dueño también puede activar un perfil de navegador con su enlace personal de un solo uso. Debe abrirlo en el perfil elegido, pulsar **Vincular este navegador** y después introducir **admin** como usuario y contraseña. Cualquier persona que utilice ese perfil tendrá ese acceso. Las instalaciones local y alojada guardan sus cuentas y datos por separado.

El servidor local escucha solo en este computador y guarda los datos en SQLite, en la carpeta privada `.local`. Para reabrirlo tras reiniciar Windows, ejecuta `npm.cmd start` en la carpeta del proyecto. Para trabajar desde distintos computadores en un directorio compartido, el equipo debe abrir el mismo enlace del sitio alojado.

## Entrar al equipo y compartir sitios

**Con invitación del equipo.** En **Usuarios → Invitar al equipo**, el administrador genera un enlace privado y lo comparte directamente con la persona. Quien lo recibe abre el enlace, escribe su nombre, correo y contraseña y pulsa **Unirme y entrar**. La cuenta queda activa con rol de miembro. Una invitación permite incorporar a varias personas durante su vigencia. Para invalidarla, el administrador puede rotarla o revocarla desde el mismo panel. Las asignaciones de sitios se gestionan por separado.

**Desde la página de acceso.** Quien entra por el formulario público sigue este recorrido de aprobación.

1. **Crea tu cuenta.** En el acceso, pulsa **Crear mi cuenta**, introduce tu nombre, correo y una contraseña de al menos 12 caracteres. El correo queda listo en el formulario de entrada. Inicia sesión para consultar tu solicitud.
2. **Aprueba y asigna.** El administrador abre **Usuarios → Solicitudes pendientes → Aprobar acceso**, confirma la identidad de la persona con el equipo, selecciona su rol y las webs que podrá gestionar. También puede crear una cuenta directamente en **Usuarios → Crear usuario**.
3. **Abre tus webs.** La persona pulsa **Consultar estado** para entrar una vez aprobada. En **Mis sitios** verá las webs que le asignaron y las que haya agregado con autorización. El administrador ve todos los sitios reales del equipo.
4. **Incorpora una web una sola vez.** Si ya existe en el directorio, el administrador abre **Usuarios → Editar** para compartirla con otro miembro. Para una web nueva, cualquier miembro aprobado puede pulsar **Mis sitios → Agregar sitio**, completar la ficha y confirmar que tiene permiso para revisarla. El primer diagnóstico queda en cola y comienza el seguimiento diario.

El administrador puede restablecer una contraseña, cambiar asignaciones o desactivar una cuenta desde **Usuarios → Editar**. Una cuenta pendiente solo puede consultar su estado y cerrar sesión.

**Para vincular Google**, un administrador debe asignar la web explícitamente al miembro que hará la conexión, incluso si esa persona la registró. El administrador prepara la cuenta de servicio compartida y el responsable de la propiedad en Google le otorga lectura. Luego el miembro abre **Conexiones de Google** dentro de esa web y verifica su propiedad. Para una carpeta, Search Console requiere su prefijo de URL exacto. GA4 requiere un sitio en la raíz del dominio y un único flujo web identificable. El histórico se filtra al dominio. Para mostrar la actividad en vivo de una vinculación nueva hecha por un miembro, el administrador confirma en el paso 3 que el flujo mide únicamente esa web.

## Probar el recorrido

- **Configuración** permite al administrador editar la ficha, gestionar el acceso y retirar una web del seguimiento.
- **Diagnóstico sin agregar** comprueba hasta cuatro páginas de una URL pública autorizada o analiza exportaciones CSV de consultas de Search Console y páginas de entrada de GA4. Admite hasta 750 KB y 5.000 filas por archivo. Permite descargar el informe y termina al salir de la vista.
- **Usuarios → Consola de preparación** permite consultar el estado del servidor y de la configuración de Google. Desde allí también se descarga el instalador de Windows.

En la instalación local, **Explorar demostración** abre un espacio independiente con Madera Sur y cifras ficticias. Para trabajar con la web de un cliente, entra con tu cuenta del equipo, abre la ficha de **Mis sitios** y conecta Search Console o importa el CSV de consultas. El **Plan del sitio** te indica qué paso seguir.

1. **Auditar.** Empieza por una página con un problema importante y abre la corrección propuesta. En el inspector puedes buscar una URL, recorrer sus enlaces, comprobar qué respondió el servidor y comparar los dos últimos rastreos completos cuando su cobertura coincide.
2. **Keywords.** Elige una consulta con impresiones, abre su ficha y comprueba qué página aparece y qué necesita la persona que busca. Las sugerencias muestran de dónde viene cada idea. El taller editorial reúne consultas y variantes long-tail observadas para preparar un encargo relacionado con el negocio.
3. **Mejoras.** Elige Google, IA o ambos, define el resultado esperado y edita el encargo. Añade información propia, como medidas, precios vigentes o ejemplos, que responda a la pregunta. Cuando el equipo publique en su web, registra la URL y la fecha.
4. **Medir.** Elige un período de 7, 28 o 90 días. Explora las líneas, sus puntos destacados, las intervenciones y las explicaciones. Copia el resumen para dirección o usa la impresión del navegador para guardarlo como PDF.

Después de cada revisión diaria o manual, el analista guarda los hallazgos que conviene revisar, con su evidencia y una acción propuesta. Para interpretar un indicador o decidir si ya puedes evaluar un cambio, consulta la [metodología del inspector, el taller y la medición](docs/METODOLOGIA.md).

En **Medir → Ver la interpretación semanal**, el analizador incluido compara las semanas recientes y explica cuándo la evidencia permite proyectar la siguiente. Funciona desde el primer día y señala qué datos faltan cuando una web todavía tiene poco historial.

En la cabecera, **Mi IA** permite guardar tu clave personal de OpenAI, Claude o Gemini para esa sesión. En **Keywords → Ideas para el redactor** puedes explorar oportunidades gratis o pedir hasta cinco propuestas en una solicitud a tu proveedor. La generación usa la cuota o el saldo de tu cuenta. Para eliminar la conexión, abre **Mi IA → Olvidar mi clave**.

El icono de mascota de la cabecera abre tu compañía. Elige el animal, ponle un apodo y consulta una pista para el paso actual. Registrar, aplicar y cerrar mejoras hace crecer su jardín. El progreso se guarda por cuenta en ese navegador. Puedes pedir un paseo, pausarlos u ocultar la compañía.

## Conectar las visitas y medir la visibilidad en IA

En Google Cloud habilita Analytics Admin API y Analytics Data API. En la propiedad GA4 concede permiso de lector a la cuenta de servicio. Puedes utilizar la cuenta de Search Console o preparar una cuenta para Analytics. En **Conexiones de Google → Google Analytics 4**, introduce el ID numérico de la propiedad. En Configuración del sitio puedes indicar un objetivo comercial, por ejemplo obtener solicitudes de presupuesto. El piloto vincula una web registrada en la raíz del dominio con un único flujo web identificable por su URL predeterminada.

El histórico diario incluye sesiones, usuarios activos por día y eventos clave medidos en Analytics. Para interpretar conversiones, el administrador debe comprobar en GA4 que los eventos clave representan los objetivos comerciales del negocio. Las señales de la página de entrada describen sus visitas desde los canales incluidos. La asignación a una búsqueda concreta requiere evidencia adicional.

Mientras Medir está visible, el bloque de actividad consulta aproximadamente cada minuto los últimos 30 minutos de ese flujo. Las vistas pueden incluir varias de la misma persona. El histórico se sincroniza al vincular la propiedad y con las revisiones posteriores. Google Search Console aporta consultas y clics con la fecha que expone la fuente. [GA4 en tiempo real](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema).

El equipo puede registrar una respuesta observada en un motor de IA con su pregunta, fecha, mención y URL citada cuando corresponda. Incluye también observaciones sin mención o cita. El informe identifica los motores, el período y el tamaño de esa muestra. La demostración utiliza ejemplos ficticios para enseñar la lectura de cada gráfico.

Ejemplo de CSV delimitado por comas. Sustituye el dominio por el registrado. Los importes de ejemplo son ficticios.

~~~csv
Fecha,Consulta,Página,País,Dispositivo,Clics,Impresiones,Posición
2026-10-20,mesa plegable para cocina,https://taller.example/mesas,Chile,MOBILE,2,80,11.5
~~~

La importación admite cabeceras en español e inglés, coma, tabulación o punto y coma. Se pueden importar ideas con solo la columna Consulta. Un archivo sin fecha sirve para investigar, pero las comparaciones temporales requieren fechas. Cada importación admite hasta 5.000 filas o 1,5 MB. El piloto conserva hasta 50.000 observaciones por sitio. Al alcanzar el tope preserva las anteriores y muestra la limitación.

## Conectar Search Console

Abre una web de **Mis sitios → Conexiones de Google**. Cada fuente tiene una guía con ilustraciones para preparar la cuenta de servicio, concederle permisos y comprobar la propiedad. En Windows, el administrador local puede elegir el archivo JSON original. SEOBESTIA lo protege con DPAPI de la cuenta de Windows que ejecuta el programa y lo guarda fuera de la carpeta del proyecto. Un cambio de cuenta de Windows o de ubicación de la base puede requerir importar el archivo otra vez. La cuenta de Search Console sirve también para GA4 si no se configura una independiente. La conexión con la propiedad se confirma tras la respuesta de Google.

En el enlace del equipo, quien gestiona el alojamiento configura `SEO_GOOGLE_VAULT_KEY` como secreto privado de todas las funciones y vuelve a desplegar. Debe contener 32 bytes aleatorios exclusivos de este proyecto, representados en base64 o por 64 caracteres hexadecimales. Entonces el administrador puede subir el JSON en **Conexiones de Google → Preparar la cuenta**. El servidor lo cifra en PostgreSQL. Para reemplazar la cuenta, sube el nuevo archivo, concede los permisos en Google y vuelve a comprobar la propiedad. Las funciones y las revisiones usan la cuenta actualizada en su siguiente ejecución. Si ya se configuró la credencial de una fuente mediante una variable de entorno, esa variable tiene prioridad para esa fuente.

La sincronización lee resultados finales de búsqueda web. Obtiene hasta 28 días iniciales, revisa días recientes y conserva totales diarios por separado. El detalle se acota a 500 filas por día. Los días truncados quedan indicados. El rango de la fuente y su posición media se muestran junto a la evidencia. [Autorización oficial](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing) · [Extracción y límites](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data).

## Preparar el despliegue del equipo

1. En una cuenta propia Neon Free, crea un proyecto PostgreSQL y obtén la conexión con TLS. Usa un usuario de aplicación con acceso al esquema del piloto. El arranque aplica la migración incluida. Prepara un bucket privado de Neon Object Storage y credenciales limitadas para las copias.
2. Configura un proyecto Netlify Free con Node 24, directorio publicado public y funciones netlify/functions. El repositorio incluye netlify.toml y el archivo de versiones de dependencias. Usa un despliegue publicado para verificar la programación real. Mantén los datos de prueba y las credenciales de producción en contextos separados.
3. En variables privadas de ejecución configura DATABASE_URL, SEO_ADMIN_EMAIL y SEO_ADMIN_PASSWORD para la primera cuenta. Configura SEO_WORKER_TOKEN y SEO_BACKUP_KEY con dos secretos aleatorios diferentes de al menos 32 caracteres, y las variables SEO_S3_* del ejemplo. Conserva una copia independiente de la clave de respaldo. Los miembros del equipo usan las cuentas de la aplicación.
4. Abre el enlace del despliegue e inicia sesión con el correo del administrador inicial o con el alias **admin** y su contraseña privada. El servidor crea esta cuenta la primera vez. Una vez que existe un administrador habilitado, aparece **Crear mi cuenta** para que el resto del equipo solicite acceso. Comparte el enlace de la aplicación con los miembros y conserva las credenciales administrativas en privado.
5. Comprueba que tick está programado y que review-background recibe trabajos. El tick corre al minuto 17 de cada hora UTC y usa la fecha de America/Santiago para reservar una revisión diaria por sitio. Cada disparo puede despertar un trabajador. Este reclama un lote, guarda resultados y libera su reserva. Los intentos interrumpidos se recuperan al vencer el bloqueo. La vista puede permanecer cerrada. [Funciones programadas](https://docs.netlify.com/build/functions/scheduled-functions/) · [Segundo plano](https://docs.netlify.com/build/functions/background-functions/).

El piloto alojado con PostgreSQL admite hasta tres webs en seguimiento. En la instalación local con SQLite se pueden agregar más. Cada sitio admite hasta tres revisiones manuales adicionales por día. Comprueba el consumo real en los paneles de Netlify y Neon al conectar el primer sitio, antes de ampliar la carga. La cuenta del proveedor puede pausar servicios cuando agote su cuota gratuita.

## Respaldo y restauración

Custodia la clave de cifrado de Google separada de la base de datos y del secreto de los respaldos. Los respaldos exportados por la aplicación excluyen las credenciales de Google. Al restaurar en otro proyecto, configura su propia clave de cifrado y vuelve a subir el JSON de cada cuenta. Si reemplazas la clave de cifrado de una instalación, tendrás que volver a subir sus archivos de Google.

El planificador incluye un respaldo diario cuando hay sitios reales. En local guarda copias cifradas en .local/backups y genera una clave inicial fuera de esa subcarpeta. En PostgreSQL usa el bucket S3 privado configurado. Conserva siete copias diarias y hasta cuatro semanales más antiguas. Descarga periódicamente una copia fuera del proveedor y custodia su clave por separado.

Para crear una copia manual ejecuta npm.cmd run backup -- save. Para una prueba de restauración selecciona **una base de destino separada**, la clave y el respaldo correctos. El comando npm.cmd run backup -- restore AAAA-MM-DD --replace reemplaza los datos de ese destino y cierra sesiones. Comprueba inventario de sitios, tareas, versiones y observaciones tras recuperar.

## Verificación

Ejecuta npm.cmd test. La prueba opcional PostgreSQL usa el entorno dedicado que describe [Validación del almacenamiento](docs/VALIDACION_ALMACEN.md). La suite comprueba autorización, concurrencia, importación sin duplicados, archivos de respaldo, rastreo con límites, respuestas controladas de Search Console, revisión por fecha local y seguimiento editorial.

Se verificaron el registro, la aprobación y el acceso a las webs asignadas en Chrome de escritorio y móvil. También se ejecutaron las tres funciones del paquete de Netlify, extraídas en un directorio aislado, con PostgreSQL temporal. La API creó el administrador inicial desde su hash, reconoció su alias y conservó los permisos del miembro al iniciar sesión. La aceptación en nube requiere comprobar el despliegue publicado, los permisos reales de Search Console, la restauración desde el bucket y dos ciclos diarios sin interacción. Las mediciones de posicionamiento requieren datos posteriores a cambios aplicados en una web real.

## Alcance del piloto

El piloto evalúa el HTML recibido del servidor. El equipo puede investigar búsquedas, preparar encargos y seguir sus resultados con reglas que funcionan sin una clave de IA. Las citas en asistentes se registran con muestras manuales. El alcance y las decisiones de infraestructura se describen en la [propuesta del piloto](docs/PROPUESTA_PILOTO.md) y el [estudio de viabilidad](docs/VIABILIDAD_Y_ARQUITECTURA_GRATUITA.md).

