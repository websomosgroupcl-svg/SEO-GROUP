# SEOBESTIA — Viabilidad de datos, componentes y operación gratuita

**Fecha de revisión:** 3 de noviembre de 2026.  
**Alcance:** punto 2; investigación documental y decisión técnica para preparar el piloto. No se crearon cuentas, infraestructura ni conexiones, ni se hicieron llamadas con credenciales privadas.

## 1. Dictamen

**El núcleo es viable sin suscripciones ni APIs pagadas para una carga acotada.** No es viable prometer datos completos de todas las keywords del mercado, posiciones exactas ilimitadas, generación ilimitada de textos y operación de cualquier volumen por cero costo.

Decisión: preparar el piloto con **Netlify Free + PostgreSQL en Neon Free**, trabajos nativos de Netlify y crawler HTTP propio apoyado en librerías abiertas. No guardar datos en Git. No depender de un computador encendido para la revisión diaria del piloto.

Ambos publican planes gratuitos sin vencimiento de prueba. Esto no constituye garantía perpetua de condiciones ni disponibilidad. La selección es documental; se certificará operativamente con una prueba de cuotas, concurrencia, programación y restauración durante la primera entrega. [Netlify Free](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) · [Neon Free](https://neon.com/pricing).

Para keywords: Search Console será la fuente principal de oportunidades demostradas; el rastreo, las necesidades del negocio y las importaciones ampliarán candidatos. Keyword Planner será un conector condicionado a acceso existente y aprobado, nunca requisito del producto.

## 2. Qué queda confirmado y qué no

- **Confirmado documentalmente:** capacidades y límites publicados en las fuentes enlazadas.
- **Decisión de ingeniería:** selección de arquitectura, presupuestos internos y prioridades propuesta a partir de esas capacidades.
- **Por probar en cuenta real:** acceso, cuotas efectivas, datos del sitio, consumo y funcionamiento programado. No confundir documentación con una prueba realizada.
- **No comprometido:** capacidades sin acceso gratuito estable identificado.

Las cifras corresponden a las páginas consultadas; la cuenta del proveedor debe confirmar su aplicación antes del despliegue. Algunos resúmenes automáticos de documentación conservan información antigua: se priorizó el cuerpo detallado de la documentación.

## 3. Fuentes y límites

### 3.1 Search Console — fuente principal

Permite medir consultas y páginas del sitio autorizado mediante clics, impresiones, CTR y posición media. Su guía documenta páginas de hasta 25.000 filas y un máximo expuesto de 50.000 filas diarias por tipo de búsqueda; agrupar por página/consulta puede perder datos. El retraso típico informado es 2–3 días. Por tanto, no prometer extracción completa de todas las búsquedas ni datos de hoy definitivos. [Guía de extracción](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data).

Límites publicados: 1.200 consultas/minuto por sitio y por usuario; además existen límites de carga. URL Inspection permite 2.000 consultas diarias y 600/minuto por sitio. Nuestra frecuencia será muy inferior. [Cuotas](https://developers.google.com/webmaster-tools/limits).

Decisiones: acceso de solo lectura al rendimiento; conexión autorizada por sitio; totales separados de desgloses para no reconstruir totales sumando filas incompletas. Releer una ventana reciente para actualizar preliminares sin duplicarlos, mostrando la fecha real y el estado. [Parámetros de consulta](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).

Valor: detectar consultas en las que ya aparece la web, long-tail observadas, páginas próximas a mejorar, variaciones y posibles solapamientos. Límite decisivo: no representa la demanda total de términos para los que el sitio no aparece.

### 3.2 Keyword Planner — opcional condicionado

El panel exige completar la cuenta con información de facturación incluso para funciones básicas de ideas. Eso no prueba que cada consulta cobre, pero impide ofrecerlo como acceso sin requisitos para todo usuario. [Requisitos del panel](https://support.google.com/google-ads/answer/7337243?hl=en).

La documentación actual asigna acceso al proyecto de Google Cloud; indica retirada de developer tokens el 9 de septiembre de 2026. Explorer restringe KeywordPlanIdeaService; Basic permite 15.000 operaciones/día y exige verificación de marca para solicitarlo. No basar la integración en tutoriales antiguos ni prometer aprobación. [Niveles de acceso](https://developers.google.com/google-ads/api/docs/api-policy/access-levels).

El servicio puede generar ideas e históricos; documenta históricos de hasta 10.000 keywords y recomienda caché porque las métricas históricas se renuevan mensualmente. No tiene sentido consultar todo diariamente. [Keyword planning](https://developers.google.com/google-ads/api/docs/keyword-planning/overview).

Decisión: si el equipo ya tiene acceso válido y puede usarlo sin contratar ni activar gasto, conectarlo después de una prueba. En caso contrario, permitir importar archivos obtenidos legítimamente. No crear campañas, activar facturación ni usar cuentas de prueba como evidencia de demanda real.

### 3.3 Rastreo propio — núcleo técnico y editorial

Podemos obtener estados, encabezados, metadatos, enlaces, canónicas, robots, sitemap, contenido y datos estructurados de webs autorizadas. La cobertura depende de accesibilidad, robots y renderizado. Se construye análisis HTTP y detección de cambios; no necesita un índice comercial externo.

El contenido de competidores puede analizarse desde URLs públicas aportadas, con límites y procedencia. Esto no revela sus keywords completas, tráfico ni backlinks. Las sugerencias derivadas se muestran como hipótesis.

### 3.4 PageSpeed Insights y CrUX

PSI ofrece auditorías Lighthouse y recomendaciones. La documentación recomienda clave para consultas automatizadas y anticipa retirar sus datos de campo; consultar CrUX por separado. No se verificó una cuota universal actual de 25.000/día: leer la cuota efectiva del proyecto. Conector condicionado a habilitación sin facturación y prueba de acceso. [PSI](https://developers.google.com/speed/docs/insights/v5/get-started).

CrUX publica 150 consultas/minuto por proyecto sin cargo. Sus métricas son una ventana móvil de 28 días, no una medición aislada del día anterior. Si una URL no tiene datos, mostrarlo y probar origen, sin sustituirlo por una nota inventada. [CrUX](https://developer.chrome.com/docs/crux/api/).

Frecuencia de diseño: CrUX por origen diario; PSI semanal en una selección pequeña de páginas. No usar PSI como crawler completo.

### 3.5 Bing y GA4 — complementarios

Bing documenta datos de sitios registrados: rendimiento, enlaces, keywords y rastreo; anuncia retiro de SOAP/POX, por lo que solo se considerará REST. El acceso puede ser por OAuth o clave y requiere sitio verificado. No confirmar por extensión lógica que AI Performance esté disponible vía API. [Bing API](https://learn.microsoft.com/en-us/bingwebmaster/) · [Acceso](https://learn.microsoft.com/en-us/bingwebmaster/getting-access).

GA4 aporta sesiones y conversiones si ya están correctamente configuradas. Para propiedades estándar, las cuotas Core publicadas incluyen 200.000 tokens/día, 40.000/hora por propiedad y 14.000/hora por proyecto y propiedad. Son tokens de cuota, no tokens de IA. Usar returnPropertyQuota y consultas resumidas. [GA4](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas).

Ambos son opcionales: sin GA4 no se concluye sobre ventas; sin Bing no se fingen enlaces entrantes.

### 3.6 Fuentes que no serán dependencias

- Google Trends API sigue anunciado como alfa por solicitud y grupo limitado: usar importación manual de datos disponibles, no depender de obtener plaza. [Trends](https://developers.google.com/search/apis/trends).
- Custom Search JSON API está cerrado a clientes nuevos y anuncia migración antes del 1 de enero de 2027: descartado como base sostenible. [Custom Search](https://developers.google.com/custom-search/v1/overview).
- No se identificó en esta investigación una API oficial gratuita general que entregue SERP completa, People Also Ask y AI Overviews para todas las consultas. Capturas manuales e importación primero; extensión posterior.
- Autocomplete no tiene en esta evaluación un contrato oficial comprobado que permita depender de él. No será necesario para operar ni se tratarán sus sugerencias como volúmenes.

## 4. Cómo investigar keywords sin inventar datos

Dos listas explícitas:

**Oportunidades observadas:** consultas propias y otras fuentes verificadas, con período, país, métricas disponibles y página objetivo.

**Oportunidades por validar:** necesidades del negocio, preguntas extraídas de páginas, long-tail y variantes propuestas. Pueden ser editorialmente pertinentes sin que hayamos medido demanda.

Proceso: importar evidencia → normalizar conservando país/idioma → clasificar intención → agrupar por necesidad → asignar página existente o nueva → priorizar por relevancia, evidencia y esfuerzo → generar brief → medir después.

Ejemplo de lógica, no dato real: una consulta observada sobre plazos de un servicio que ya recibe impresiones puede justificar mejorar su página. Una variante específica sugerida por el sistema queda pendiente de validación, sin un número inventado de búsquedas.

**Límite para sitios nuevos:** sin historial ni acceso a una fuente de demanda, podremos investigar temas, intención y cobertura, pero no certificar volumen ni facilidad de posicionamiento. La alternativa gratuita exige más validación humana. Esta brecha no se resuelve copiando código de una suite.

## 5. Reutilización open source

Revisión de repositorios y documentación, no auditoría integral de seguridad ni ejecución de sus pruebas. Las licencias corresponden a la raíz consultada; antes de copiar se fijará commit/versión y se revisarán archivos y dependencias concretos.

| Componente | Licencia publicada | Uso decidido |
|---|---|---|
| [Crawlee](https://github.com/apify/crawlee) | Apache-2.0 | Reutilizar componentes HTTP, control de concurrencia y reintentos; adaptar la cola durable al almacenamiento propio. Sin contratar Apify ni sus proxies. |
| [Cheerio](https://github.com/cheeriojs/cheerio) | MIT | Parseo HTML/XML para extracción y reglas. |
| [Readability](https://github.com/mozilla/readability) | Apache-2.0 | Extracción editorial; no sustituye sanitización ni cubre perfectamente toda ficha de producto. |
| [Playwright](https://github.com/microsoft/playwright) | Apache-2.0 | Pruebas de interfaz y renderizado selectivo posterior. No asumir Chromium masivo en la cuota gratuita. |
| [SerpBear](https://github.com/towfiqi/serpbear) | MIT | Referencia de seguimiento, historial e integración GSC; adaptar piezas, no adoptar la aplicación completa. |
| [OpenSEO](https://github.com/every-app/open-seo) | MIT | Referencia de UX, contexto y flujo de investigación. No adoptar su fuente DataForSEO de pago. |
| [SEOnaut](https://github.com/stjudewashere/seonaut) | MIT | Referencia de reglas, severidad y evidencia; no añadir otra aplicación Go/MySQL al núcleo. |
| [SiteOne](https://github.com/janreges/siteone-crawler) | MIT | Referencia de reportes y comparación independiente en pruebas; no hacer de su ejecutable otra dependencia residente. |
| [Can I Vibe Code It](https://github.com/canivibecodeit/canivibecodeit) | MIT | Adaptar requisitos y prompts con atribución; eliminar dependencias y alcances incompatibles. |

Hallazgos concretos: SerpBear depende de servicios de scraping o proxies para su tracking SERP. OpenSEO declara que el usuario necesita DataForSEO y paga por consumo. Su código abierto no convierte esos datos en gratuitos. El prompt de [Frase](https://canivibecodeit.com/frase) pide Serper y un modelo; el de [auditoría](https://canivibecodeit.com/screaming-frog-seo-spider) es aprovechable como lista de requisitos, no como sustituto del producto completo.

No hacer un fork completo: mantener una aplicación propia reduce dependencias pagadas heredadas y permite diseñar el seguimiento diario desde el principio. No copiar los esquemas de puntuación sin probarlos con fixtures.

## 6. Alojamiento comparado

| Alternativa | Evidencia y restricción | Decisión |
|---|---|---|
| Netlify Free | Plan con límite duro de 300 créditos/mes; funciones background hasta 15 minutos incluidas en Free por créditos. | Elegido para piloto acotado. |
| Neon Free | Sin vencimiento de prueba ni tarjeta obligatoria; 1 GB Postgres y 100 CU-h/mes por proyecto. | Elegido para datos. |
| Cloudflare Workers + D1 | Workers Free: 10 ms de CPU por petición y también por cron. D1: 5 millones de filas leídas/día, 100.000 escritas/día, 5 GB totales. | Buena alternativa de frontend/API pequeña; no elegida para ejecutar este crawler y análisis completos. |
| GitHub Actions como worker | La documentación advierte retrasos e incluso descarte de ejecuciones programadas con carga alta. | CI y pruebas; no planificador principal del producto. |
| Render Free | Base gratuita expira a 30 días y servicios gratuitos tienen restricciones de suspensión/disco. | Descartado como solución integral persistente. |
| Vercel Hobby | Uso personal no comercial. | Descartado para equipo que trabaja con clientes. |
| Oracle Always Free | Recursos no temporales, pero instancias inactivas pueden recuperarse por el proveedor. | No elegirlo como dependencia principal de un equipo sin operación de servidores. |
| Servidor propio existente | Evita cuotas de cómputo del hosting; exige equipo, electricidad, conexión, operación y respaldo. | Ruta de salida; no afirmar costo cero ni disponibilidad de hardware que no hemos comprobado. |

Fuentes: [Netlify background](https://docs.netlify.com/build/functions/background-functions/), [Workers](https://developers.cloudflare.com/workers/platform/limits/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Render](https://render.com/docs/free), [Vercel](https://vercel.com/docs/plans/hobby), [Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

No se selecciona un enlace temporal de desarrollo ni el entorno de este chat como servidor. El sistema desplegado tendrá su propio acceso y planificador.

## 7. Arquitectura elegida para preparar el piloto

- Aplicación TypeScript/React, con interfaz mayormente estática para reducir consumo y API Node en Netlify.
- PostgreSQL estándar en una cuenta Neon Free del propietario, independiente de Netlify Database. Evitar que la base consuma el mismo presupuesto de créditos de la web.
- Accesos individuales administrados por la aplicación. Los miembros usan SEOBESTIA y no necesitan asientos de colaboración en el proveedor de hosting. Sin registro público; altas y recuperación por administrador, sin correo de pago.
- Trabajos nativos scheduled/background, cola en PostgreSQL y un ejecutor reutilizable posteriormente en Node sobre servidor propio.
- Datos, secretos y clientes nunca en un repositorio público. No depender de repositorio privado de organización si el proveedor lo reserva a un plan pagado: despliegue por CLI bajo una cuenta administradora sin contratar asientos.
- Subdominio gratuito del proveedor; no hace falta comprar dominio.

## 8. Programación y recuperación diaria

Netlify documenta cron en UTC, ejecución automática solo en despliegues publicados y límite de 30 segundos para scheduled. Background permite 15 minutos y reintentos. [Programación](https://docs.netlify.com/build/functions/scheduled-functions/) · [Background](https://docs.netlify.com/build/functions/background-functions/).

Diseño: un tick horario corto calcula si cada sitio tiene pendiente su revisión local del día y encola una sola ejecución por sitio/fecha/tipo. America/Santiago se calcula con zona IANA para respetar cambios de horario; no fijar permanentemente UTC−3.

El tick no rastrea: despierta un worker autenticado. Este toma lotes con bloqueo transaccional y vencimiento, guarda cursor y termina antes del límite. Un tick posterior recupera bloqueos vencidos y trabajo incompleto; las claves idempotentes evitan efectos duplicados.

Prioridad diaria: disponibilidad/robots y cambios críticos → datos GSC disponibles → páginas nuevas o modificadas → tareas y alertas → históricos y rastreo completo semanal. Botón Ejecutar ahora con el mismo presupuesto, sin saltarse límites.

Mostrar por separado última ejecución y datos hasta. Si el proveedor cae, se pierde un disparo o se agota cuota, el sistema no ha cumplido la revisión diaria: registrarlo y recuperar pendientes. No prometer SLA 24/7 ni reemplazar una falta de datos con cero. Si el hosting entero se pausa, una alerta solo interna tampoco podrá verse hasta recuperarlo.

## 9. Presupuesto de operación propuesto

**Escenario de diseño, no benchmark:** 3 sitios, hasta 500 URLs por sitio, 5 miembros y aproximadamente 500 filas GSC detalladas por sitio/día. Revisión diaria de hasta 30 URLs prioritarias por sitio; rastreo completo repartido semanalmente; PSI de 5 páginas por sitio/semana. Ajustar antes de admitir más carga.

Tarifas publicadas: despliegue de producción 15 créditos; cómputo 10 créditos/GB-h; transferencia web 20 créditos/GB; 2 créditos/10.000 solicitudes. [Precios Netlify](https://www.netlify.com/pricing/).

Estimación para 31 días, suponiendo 1 GB efectivo asignado al worker:

| Concepto | Supuesto interno | Créditos |
|---|---|---:|
| Publicaciones de producción | 4 | 60 |
| Trabajos de análisis | 10 minutos/día en total | 51,7 |
| Transferencia web | 2 GB/mes | 40 |
| Solicitudes web | 100.000/mes | 20 |
| Reserva de cómputo API, scheduler, respaldo y reintentos | 4 GB-h | 40 |
| Total previsto | Dentro de 300 | 211,7 |
| Margen | No asignado | 88,3 |

El total no certifica que todas esas URLs se procesen en diez minutos. Depende de latencias, tamaño, memoria real, timeouts, concurrencia y consumo del resto de proyectos de la cuenta. Preview evita costo de publicación, pero su tráfico y funciones también consumen recursos. Evitar publicar en producción cada ajuste durante desarrollo.

Netlify pausa proyectos al agotarse la cuota; Free no compra créditos adicionales sin cambiar de plan. [Pausa de proyectos](https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/). No activar recargas ni upgrades.

Controles: panel con consumo medido y estimado distinguibles; alerta al 60%, reducción de tareas opcionales al 75%, reserva del restante para sincronización y acceso. Proyección antes de backfill, rastreo grande o alta de sitio. Esto reduce riesgo, no garantiza impedir consumo por tráfico externo.

Neon: 100 CU-h, 1 GB de base y 5 GB de transferencia por proyecto según los planes consultados. Configurar inicialmente compute de 0,25 CU si la cuenta lo permite y scale-to-zero; 0,25 CU activo todo un mes consumiría 186 CU-h en 31 días, por lo que NO debe mantenerse despierto. Evitar polling permanente y agrupar consultas. [Planes y cálculo](https://neon.com/docs/introduction/plans).

Ejemplo interno: 10 horas activas/día × 31 × 0,25 CU = 77,5 CU-h; margen reducido que debe medirse. Al agotar cómputo o transferencia Free suspende cómputo hasta el siguiente período; al exceder almacenamiento fallan operaciones que lo aumentan. [Comportamiento de Free](https://neon.com/pricing).

## 10. Datos, archivo y respaldos

Guardar resúmenes, texto útil y evidencia mínima; no almacenar capturas completas de cada página cada día. Mantener detalle reciente e histórico agregado, con archivo comprimido antes de liberar detalle antiguo. Mostrar qué períodos están archivados y permitir recuperarlos. No borrar contenido editorial, tareas o evidencia de decisiones para ahorrar espacio silenciosamente.

Ejemplo de dimensionamiento, no medida: 3 sitios × 500 filas/día × 90 días = 135.000 filas; a 600 bytes estimados por fila serían 81 MB antes de índices, versiones y otras tablas. La primera prueba medirá tamaño real. Establecer límite interno inicial de 600 MB de base y 3 GB/mes de transferencia; no admitir más historial automáticamente si compromete margen.

Neon publica Object Storage de 5 GB en Free y una API de objetos tipo S3. Diseñar exportación lógica consistente, comprimida y cifrada, con manifiesto/checksum, hacia un bucket privado. Rotación inicial de 7 copias diarias y 4 semanales, limitada por bytes y con fallo visible si no cabe. [Capacidad](https://neon.com/docs/introduction/plans) · [API de almacenamiento](https://neon.com/docs/storage/overview).

Las copias en el mismo proveedor no cubren pérdida de cuenta: descarga semanal por el administrador a almacenamiento existente fuera de Neon. No vender esto como respaldo externo automático. La transferencia del respaldo también consume cuota; reducir cambios exportados cuando sea necesario y medir restauración antes del piloto.

La documentación de planes de Neon presenta una discrepancia: su tabla marca Instant restore no disponible en Free, mientras su sección detallada describe hasta 6 horas/1 GB de historial. No depender de esa recuperación para el producto ni de backups programados nativos pagados. La exportación propia y prueba de restauración son requisito de salida.

## 11. IA opcional y contenido

Gemini publica un nivel gratuito para ciertos modelos y avisa que puede utilizar contenido para mejorar productos; los límites varían por proyecto/modelo y se consultan en AI Studio. No fijar 1.500 llamadas diarias como derecho universal. [Precios](https://ai.google.dev/gemini-api/docs/pricing) · [Límites](https://aistudio.google.com/docs/rate-limits).

Decisión: núcleo sin IA; asistencia gratuita desactivada hasta verificar modelo, cuota y aceptación del tratamiento de datos. No activar grounding ni herramientas con costo. No enviar datos confidenciales de clientes por defecto.

[Ollama](https://github.com/ollama/ollama) es candidato local; el runtime no sustituye verificar licencia de cada modelo ni hardware. No ejecutarlo dentro de una función serverless ni prometer calidad editorial sin evaluación en español. No hace falta elegir modelo para construir el núcleo determinista.

## 12. Condiciones antes de declarar operativo

1. Cuentas reales Free permanentes bajo control del propietario, sin recursos temporales sin reclamar, upgrades ni facturación adicional.
2. Una propiedad GSC con permiso y una prueba de lectura; confirmar límites efectivos de PSI/CrUX/Bing si se conectan.
3. Prototipo mínimo desplegado que ejecute dos ciclos diarios sin interfaz abierta y recupere una interrupción.
4. Prueba de concurrencia, credenciales, bloqueo, cursor y deduplicación.
5. Medición de CPU/memoria/tiempo, créditos, CU-h, almacenamiento y transferencia con un sitio representativo.
6. Restauración de respaldo en base separada, con filas y relaciones verificadas.
7. Prueba de contenido dependiente de JavaScript: si el sitio piloto lo necesita y no podemos medirlo en el presupuesto, declarar auditoría parcial y habilitar ejecutor propio antes de prometer cobertura completa.

Estas son pruebas de implementación futuras, no trabajo ejecutado en esta investigación. No se necesitan pagos para investigarlas; se necesitarán cuentas y permisos del propietario en el paso correspondiente.

## 13. Ruta de crecimiento sin gasto obligatorio

Primero reducir consultas redundantes, cachear y repartir históricos. Después ajustar número de sitios, retención accesible y frecuencia de tareas secundarias preservando la revisión diaria esencial.

Si el uso real no cabe, usar Node + PostgreSQL en un servidor existente del equipo, manteniendo servicios y modelo de datos; cambiar adaptadores, despliegue, cron y respaldo. No será cero trabajo ni cero costo operativo. Si no existe ese equipo y se exige más capacidad garantizada, la restricción de cero gasto impide prometerla. No ocultarlo con cuentas múltiples o trials rotativos.

**Resultado del punto 2:** viabilidad documental favorable para un piloto acotado; arquitectura elegida, fuentes y límites identificados. Pendiente la validación operativa con cuentas y datos reales durante implementación. El siguiente punto es concretar la primera entrega y su plan, sin contratar ni publicar nada en esta fase.
