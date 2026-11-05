# SEOBESTIA — Instrucciones totales de construcción
### Plataforma open source de SEO · GEO · AEO, 100% gratuita, sin bases de datos externas, desplegable en Netlify

**Versión:** 2.0 — Documento definitivo de construcción
**Fecha:** 3 de noviembre de 2026
**Destinatario:** equipo técnico de desarrollo
**Naturaleza:** este documento contiene todo lo necesario para construir el sistema. No contiene código; contiene decisiones cerradas, especificaciones, procedimientos paso a paso, prompts de construcción para agentes de código y fuentes verificadas. No incluye estimaciones de tiempo por decisión de la dirección del proyecto.

---

## 0. Cómo usar este documento

El documento se lee de principio a fin una vez y luego se usa como referencia por secciones. El orden de construcción está en la sección 14 (etapas) y los prompts para agentes de código en la sección 15. Nada de lo que aquí se decide se reabre durante la construcción; cualquier duda que no resuelva el documento se registra en `docs/DECISIONES.md` del repositorio y se eleva a la dirección del proyecto.

Convenciones:

- **DECISIÓN** marca una decisión cerrada por la dirección del proyecto.
- **REGLA** marca una restricción de ingeniería obligatoria.
- **A VERIFICAR** marca un dato externo (cuota, endpoint, comportamiento de API) que debe comprobarse en la fuente oficial al iniciar la etapa correspondiente, porque puede haber cambiado.
- Las cifras de cuotas y límites están fechadas en noviembre de 2026 y tienen fuente en la sección 20.

---

## 1. Decisiones cerradas (no se discuten en la construcción)

| # | Decisión |
|---|---|
| D1 | **Alcance funcional:** diagnóstico y recomendaciones, generación de contenido SEO/GEO y monitoreo continuo. El sistema **no** publica ni modifica sitios web: recomienda, redacta y mide. |
| D2 | **Cero costo, cero APIs de pago.** Solo se usan APIs oficiales gratuitas y software open source. Lo que no exista en forma gratuita **se construye por código**. No se incluye ningún conector de pago, ni siquiera opcional. |
| D3 | **Sin base de datos externa.** Toda la información se guarda en archivos Excel (`.xlsx`) dentro de la carpeta `data/` del propio proyecto. El sistema los lee y los sobrescribe. No se depende de Postgres, Supabase, Neon, SQLite remoto ni servicios de almacenamiento de terceros. |
| D4 | **Despliegue inicial en Netlify, plan gratuito.** El proyecto debe poder moverse después a un servidor propio sin cambios de arquitectura (modo local/servidor con escritura directa a disco). |
| D5 | **Persistencia en Netlify:** como las funciones de Netlify no conservan archivos escritos, en ese entorno el Excel se persiste dentro del repositorio Git del proyecto (cada escritura es un commit automático al archivo). Así los datos viajan siempre con la carpeta del proyecto. |
| D6 | **Acceso interno compartido:** una sola contraseña de acceso definida en variable de entorno. Sin cuentas por correo, sin roles, sin registro de usuarios. |
| D7 | **Notificaciones solo dentro del sistema:** campana de notificaciones y sección "Alertas del día". Sin correo, sin webhooks, sin mensajería externa. |
| D8 | **Idioma de la interfaz: español neutro**, exclusivamente. |
| D9 | **Nombre:** SEOBESTIA. Lema: "SEO · GEO · AEO". Repositorio: `seobestia`. Licencia MIT. |
| D10 | **Política de bots de IA por defecto:** permitir todos los robots de búsqueda y de entrenamiento de IA en los sitios analizados, con un interruptor por sitio para bloquear los de entrenamiento. |
| D11 | **Verticales con plantilla inicial:** legal, e-commerce, SaaS, negocio local y una plantilla genérica, en ese orden. |
| D12 | **Referencias obligatorias:** se aprovechan el software open source y los prompts de canivibecodeit.com indicados en la sección 4, complementados con desarrollo propio. SerpBear y OpenSEO se usan como referencia funcional y de código (ambos MIT). |
| D13 | **Estándar de producto:** completo y user friendly. Se construye con calidad de producto público desde el primer día aunque el uso sea interno. |

---

## 2. Qué es SEOBESTIA

SEOBESTIA es una aplicación web que concentra en un solo lugar el ciclo completo de posicionamiento orgánico moderno para uno o muchos sitios:

1. Conectar un sitio a sus fuentes oficiales gratuitas (Google Search Console, Google Keyword Planner, PageSpeed Insights, Chrome UX Report, Bing Webmaster Tools, Gemini).
2. Entender su rendimiento real: consultas, páginas, posiciones, clics, impresiones, cobertura de índice, con historial que no se borra nunca.
3. Investigar keywords con volumen real, clasificar su intención de búsqueda y agruparlas por tema.
4. Auditar el sitio técnicamente y en contenido, incluida su preparación para ser leído y citado por motores de IA.
5. Convertir todo lo anterior en un plan de acción priorizado con impacto estimado y evidencia.
6. Producir briefs y borradores de contenido optimizados para Google y para ser citados por ChatGPT, Gemini, Perplexity, Claude, Copilot, AI Overviews y AI Mode, con puntuación SEO y GEO.
7. Medir la visibilidad de la marca en motores de IA: menciones, citas, fuentes que ganan, brechas frente a competidores.
8. Vigilar todo lo anterior y avisar dentro del sistema cuando algo cae, sube o se rompe.

La tesis técnica que lo hace posible sin pagar: **los datos propios oficiales son más precisos que las estimaciones de las suites de pago**. Search Console entrega posiciones y clics reales; Keyword Planner entrega volúmenes reales; CrUX entrega rendimiento de usuarios reales; Bing Webmaster entrega keywords, backlinks y citas en Copilot; y los modelos de IA consultados por API permiten medir menciones y citas. Lo que Semrush, Ahrefs o Profound venden es, sobre todo, índices propietarios y comodidad. SEOBESTIA no replica esos índices: exprime a fondo los datos propios y los combina con IA gratuita para producir recomendaciones, contenido y medición.

---

## 3. Límites conocidos y cómo se resuelven por código

Estos límites derivan de D2 y D3 y deben quedar explicados en la interfaz del producto, nunca ocultos.

| Límite | Causa | Solución construida por código |
|---|---|---|
| No existe API oficial gratuita de resultados de Google (SERP), People Also Ask ni AI Overviews | Google no la ofrece; Custom Search JSON API cierra el 1 de enero de 2027 y nunca devolvió el SERP real | (a) **Posición oficial desde Search Console** como fuente principal de ranking; (b) **extensión de navegador propia** que captura lo que la persona ve en Google, ChatGPT, Gemini y Perplexity y lo envía al sistema (gratis, conforme a términos de servicio); (c) **módulo de captura automatizada best-effort** con Playwright, solo activable en servidor propio, con límites estrictos y riesgos documentados (sección 9.6) |
| No hay índice de backlinks ni keywords de dominios ajenos | Son los índices propietarios de las suites de pago | Backlinks del sitio propio desde Bing Webmaster; competidores analizados por sus páginas públicas y por las citas que los motores de IA les hacen; dificultad calculada en relación al propio sitio (sección 10.4) |
| Solo Gemini tiene nivel gratuito de API entre los modelos de IA | OpenAI, Anthropic y Perplexity cobran por uso en 2026 | Gemini gratuito como motor por defecto; Ollama (modelos locales) para modo servidor propio; **modo manual** de pegado de respuestas; extensión de navegador para capturar respuestas reales de ChatGPT, Gemini y Perplexity desde el navegador del usuario |
| Excel no es una base de datos | Límite de 1.048.576 filas por hoja; sin índices; lectura completa del archivo | Particionado por sitio y por mes, caché en memoria por ejecución, agregados precalculados en hojas de resumen, reglas de retención configurables (sección 8) |
| Netlify no conserva archivos escritos por funciones | Sistema de archivos efímero | Persistencia en el repositorio Git mediante commits automáticos (D5, sección 8.3); en servidor propio, escritura directa |
| Plan gratuito de Netlify con créditos limitados | 300 créditos/mes; funciones síncronas 60 s; background 15 min; scheduled 30 s | Trabajos por lotes encadenados, frecuencia diaria/semanal, presupuesto de ejecuciones visible en la interfaz (sección 9.5) |

---

## 4. Qué se aprovecha de terceros (open source y prompts)

### 4.1 Software open source que se integra o se toma como referencia

| Proyecto | Licencia | Uso en SEOBESTIA |
|---|---|---|
| **Crawlee** (apify/crawlee) | Apache-2.0 | Motor del crawler: CheerioCrawler (HTTP) en Netlify; PlaywrightCrawler (render JS) en servidor propio |
| **Playwright** | Apache-2.0 | Render de páginas JS, generación de PDF, captura automatizada best-effort (solo servidor propio) |
| **cheerio**, **@mozilla/readability** | MIT / Apache-2.0 | Parseo de HTML y extracción de contenido principal de páginas de referencia |
| **ExcelJS** | MIT | Lectura y escritura de los archivos `.xlsx` de `data/` |
| **schema-dts** (Google) | Apache-2.0 | Tipado y generación de JSON-LD |
| **Vercel AI SDK** (`ai`) | Apache-2.0 | Capa de IA con proveedores Google (Gemini) y Ollama; salida estructurada con Zod |
| **Next.js**, **Tailwind CSS**, **shadcn/ui**, **Recharts**, **TanStack Table** | MIT | Interfaz y API |
| **SerpBear** (towfiqi/serpbear) | MIT | Referencia de código: integración con Search Console por service account, modelo keyword × país × dispositivo con historial, parser de SERP con cheerio y estrategia de paginación, ciclo de refresco. Se copian fragmentos con atribución |
| **OpenSEO** (every-app/open-seo) | MIT | Referencia funcional: catálogo de funciones, agente in-app, servidor MCP, "skills" para agentes de código, modo sin autenticación para uso interno |
| **elmo** (elmohq/elmo) | MIT | Referencia de métricas de visibilidad en IA: puntuación por prompt/modelo/tiempo, share of voice, fan-out, citas por dominio |
| **geo-aeo-tracker** (danishashko) | MIT | Referencia de auditoría GEO: llms.txt, schema, headings, drift |
| **geoptimize**, **geo-lint** | MIT | Referencia para el lint GEO determinista (reglas) |
| **SEOnaut**, **SiteOne Crawler**, **python-seo-analyzer**, **advertools** | MIT / BSD | Referencia de reglas de auditoría técnica |
| **llms-txt** (AnswerDotAI) | Apache-2.0 | Especificación para el generador de llms.txt |

Prohibido incorporar: GEOFlow (AGPL), SearchMirror (AGPL), Plausible (AGPL) y cualquier dependencia con licencia copyleft fuerte. El CI ejecuta `license-checker` y falla ante AGPL/GPL.

### 4.2 Prompts de canivibecodeit.com que se reutilizan

El sitio canivibecodeit.com (repositorio MIT, datos en `data/apps/*.json`) publica prompts de construcción para reemplazar SaaS. Se reutilizan, adaptados, los siguientes bloques; el texto íntegro de cada prompt original se guarda en `docs/referencias/canivibecodeit/` del repositorio para consulta del equipo:

- **Sub-bloque "crawler SEO"** (usado en Screaming Frog, Sitebulb, Oncrawl, ContentKing, Lumar, Clearscope, Seobility, WooRank, AIOSEO, Yoast): exigir confirmación de propiedad antes de rastrear; respetar robots.txt, límites, canónicas, nofollow, redirecciones y tope de URLs; recolectar estado, título, descripción, headings, canónica, robots, enlaces, imágenes, datos estructurados y texto renderizado; detectar duplicados, huérfanas, enlaces rotos, cadenas de redirección, metadatos faltantes y conflictos de indexabilidad; mostrar cada issue con URLs, evidencia, severidad y remediación; exportar CSV y reporte HTML autocontenido.
- **Sub-bloque "rank tracker"** (AccuRanker, SE Ranking, Keysearch, Nightwatch, Ubersuggest, LowFruits, Mangools, Serpstat, SpyFu, Moz): proyectos con dominios, keywords, país, idioma, dispositivo y etiquetas; snapshots crudos más posiciones normalizadas para que todo gráfico sea auditable; posición actual, movimiento, mejor posición, cambios de URL e historial compacto; ejecuciones programadas, alertas de fallo, exportación, retención y respaldo.
- **Prompts curados de visibilidad en IA** (Profound, AmICited, LLM Pulse, Rankwise, BrandGEO, CueScout, 100 Questions, VerifiedDR): una fila inmutable por corrida × prompt × motor; nunca sobrescribir corridas; concurrencia limitada por proveedor; reintentos con backoff ante 429/5xx; celdas fallidas visibles; detección de menciones por alias insensible a mayúsculas con offset de primera mención; normalización de citas a host + ruta canónica sin parámetros de tracking; tasa de mención, tasa de cita, share of voice, top de fuentes, "gaps" (prompts donde citan a competidores y no a la marca); sentimiento en una pasada posterior, nunca en línea; análisis de logs con lista editable de user agents de bots de IA y agentes desconocidos contados; toda métrica agregada enlaza a las filas que la producen; tests de fixtures para menciones, normalización y métricas; honestidad en la interfaz: "las respuestas vía API aproximan lo que ven los usuarios en las apps".
- **Prompt de Semrush / Ahrefs ("el slice que sí vale la pena")**: rastreo técnico del sitio propio, posiciones, clics e impresiones desde Search Console, reporte regenerado en cada corrida, alertas solo cuando algo se movió (más de 3 posiciones o nuevos 404), y nota explícita de que no se fingen datos de terceros.
- **Prompts de Frase / Surfer / NeuronWriter / MarketMuse (briefs)**: obtener páginas de referencia, extraer título, estructura de headings, extensión, preguntas y términos (TF-IDF simple), generar brief con outline, términos, preguntas y rango de palabras, y puntuar un borrador con porcentaje de cobertura y lista de faltantes; caché de páginas para que las repeticiones no cuesten.
- **Reglas transversales de las plantillas B y C del sitio**: primera ejecución con un comando documentado; datos locales por defecto y exportación fácil; secretos en `.env` con `.env.example`; estados vacío, de carga, de éxito y de error recuperable; validación de entradas y manejo de APIs no disponibles con modo degradado explicado; tests de la transformación central y un test end-to-end; README con instalación, arquitectura, permisos, ubicación de datos y respaldo; sin telemetría ni facturación; terminar ejecutando tests y build y listando los comandos usados.

### 4.3 Qué dicen los veredictos del sitio y por qué importa

De 42 herramientas de SEO evaluadas, el sitio considera que todo lo que depende de índices propietarios (Ahrefs, Semrush, Moz, SE Ranking, Serpstat, SpyFu, Mangools, Ubersuggest, Keysearch, AccuRanker, Nightwatch, LowFruits, SISTRIX) **no se puede replicar** y recomienda no fingirlo; que la auditoría técnica del sitio propio (Screaming Frog es la herramienta más "reemplazada" del sitio) y los briefs de contenido **sí**; y que toda la ola de "AI visibility" **sí, con brechas**. SEOBESTIA construye exactamente el conjunto de lo que el sitio marca como construible, y resuelve las brechas de datos con fuentes oficiales y con la extensión de navegador.

---
## 5. Fuentes de datos oficiales y gratuitas (noviembre de 2026)

Todas las cifras son **A VERIFICAR** al inicio de la etapa que las use.

| Fuente | Autenticación | Cuota relevante | Qué aporta | Limitación |
|---|---|---|---|---|
| **Google Search Console API — Search Analytics** | Service account agregada como usuario de la propiedad | 1.200 consultas/min por sitio; 25.000 filas por llamada con paginación ilimitada (`startRow`); 16 meses de historial | Clics, impresiones, CTR y posición por fecha, consulta, página, país, dispositivo, apariencia en búsqueda, tipo (web, discover, noticias, imagen, video); `dataState=all` para datos preliminares | Retraso de 2–3 días; consultas anonimizadas se omiten al agrupar por consulta |
| **GSC — URL Inspection** | Igual | 2.000/día y 600/min por sitio | Estado de indexación, canónica de Google vs. declarada, último rastreo, robots, rich results | Solo versión indexada |
| **GSC — Sitemaps** | Igual | 200/min por usuario | Lista, errores, envío | — |
| **Google Ads API — Keyword Planner** | OAuth con refresh token generado una vez (script local) o service account; proyecto de Google Cloud con nivel **Basic** | 1 consulta/segundo por cuenta; 15.000 operaciones/día en Basic | `generateKeywordIdeas` (semillas: 1–20 keywords, URL o sitio; hasta 10 países; idioma): volumen promedio mensual, volúmenes mensuales hasta 4 años, competencia 0–100, pujas, CPC. `generateKeywordHistoricalMetrics`: hasta 10.000 keywords por llamada | Desde el 9-sep-2026 no hay developer tokens: el nivel de acceso es del proyecto de Cloud; Basic exige verificación de marca y cuenta de Google Ads de producción; Explorer bloquea Keyword Planner; cuentas de prueba devuelven datos ficticios; el acceso se revoca tras 90 días sin uso |
| **PageSpeed Insights API v5** | API key | ~25.000/día por proyecto; cada llamada tarda 10–30 s | Lighthouse: rendimiento, SEO, accesibilidad, buenas prácticas | Google retirará de esta API los datos de campo (usar CrUX) |
| **CrUX API y CrUX History API** | API key | 150/min por proyecto, no ampliable | LCP, INP, CLS, FCP, TTFB de usuarios reales por origen y URL; 40 semanas de historial | Sin datos en URLs de poco tráfico |
| **Google Analytics Data API (GA4)** | Service account | 200.000 tokens/día y 40.000/hora por propiedad | Sesiones y conversiones; canal de referidos de IA | Opcional |
| **Bing Webmaster Tools API** | API key única por usuario | No publicada; envío de URLs hasta 10.000/día adaptativo | Keywords e impresiones en Bing (`GetKeyword`, `GetKeywordStats`, `GetRelatedKeywords`), backlinks (`GetLinkCounts`, `GetUrlLinks`), rank y tráfico, crawl, envío de URLs, reporte AI Performance (citas en Copilot) | Solo REST (SOAP/POX retirados el 31-ago-2026) |
| **IndexNow** | Clave en `/{clave}.txt` | 10.000 URLs por envío | Aviso de cambios a Bing, Yandex, Naver, Seznam, Yep, Amazon | Google no participa |
| **Gemini API (Google AI Studio)** | API key | Nivel gratuito en la familia Flash / Flash-Lite (del orden de 10 solicitudes/min y 1.500/día; confirmar en AI Studio); grounding con búsqueda de Google no incluido en el nivel gratuito para Gemini 3+ | Clasificación de intención, briefs, redacción, scoring, sentimiento, embeddings, visibilidad en IA | En el nivel gratuito Google usa los datos para mejorar sus productos (debe decirse en la interfaz) |
| **Google Autocomplete** (endpoint público no documentado) | Ninguna | Throttling por IP | Sugerencias por país e idioma (`hl`, `gl`) | No oficial; puede cambiar; se marca "best effort" y se puede desactivar |
| **Google Trends API** (alfa cerrada) | Por solicitud | — | Interés relativo con escala consistente | Sin acceso público; pytrends archivado; se deja el conector preparado y se solicita el acceso |
| **Ollama** (modelos locales) | Ninguna | Según hardware | Alternativa a Gemini en servidor propio | No disponible en Netlify |

Fuentes **no** disponibles y resueltas por código propio: SERP, PAA y AI Overviews de Google (sección 9.6); respuestas de las apps de ChatGPT/Perplexity/Gemini (extensión de navegador y modo manual); backlinks de terceros (no se fingen).

---

## 6. Módulos (alcance funcional completo)

| # | Módulo | Entrega |
|---|---|---|
| M1 | Sitios y conexiones | Alta de sitios, países, idiomas, marca y alias, competidores, vertical; asistentes de conexión; estado de cuotas |
| M2 | Rendimiento orgánico | Todo Search Console en Excel con historial perpetuo; posiciones por keyword × país × dispositivo; canibalización; quick wins; caídas; cobertura; reporte de IA generativa de GSC |
| M3 | Keywords e intención | Universo de keywords con volumen real; intención fraccional; clustering; preguntas; gaps; listas |
| M4 | Auditoría | Crawl, ~120 reglas con evidencia y remediación, CWV de campo y laboratorio, schema, enlazado interno, preparación para IA, comparación de crawls |
| M5 | Plan de acción | Lista única de tareas priorizadas por impacto con evidencia y medición de resultado a 28 días |
| M6 | Contenido SEO/GEO | Briefs, borradores, reescrituras, FAQs, JSON-LD, enlaces internos, scoring SEO y GEO, lint GEO, llms.txt, robots.txt |
| M7 | Visibilidad en IA | Prompts, corridas con Gemini/Ollama/manual/extensión, menciones, citas, share of voice, fuentes, gaps, sentimiento, referidos de IA, crawlers de IA |
| M8 | Monitoreo y notificaciones internas | Anomalías, campana, "Alertas del día", resumen semanal en pantalla |
| M9 | Captura desde navegador | Extensión que captura SERP, PAA, AI Overviews y respuestas de ChatGPT/Gemini/Perplexity y las envía al sistema |
| M10 | Integración y reportes | API REST, servidor MCP, exportación CSV/HTML/PDF, reportes por sitio |

---

## 7. Especificación funcional por módulo

### M1 — Sitios y conexiones

- Alta de sitio: dominio; tipo de propiedad en GSC (`sc-domain:` o prefijo de URL); países objetivo (varios, ISO); idiomas; nombre de marca y alias (para detección de menciones); competidores (dominio, nombre, alias); vertical (D11) que precarga intenciones y prompts; política de bots de IA (D10).
- Conexión a Google por **service account** únicamente (D6): el sistema muestra el correo de la service account (definida en variables de entorno) y las instrucciones con capturas para agregarlo como usuario con permiso "Completo" en Search Console y como lector en GA4; detecta automáticamente cuando el acceso está disponible. No se implementa OAuth de usuario.
- Conexión a Google Ads (Keyword Planner): asistente con el procedimiento de la sección 11; prueba de conexión con una keyword y visualización del volumen devuelto; diagnóstico de errores (`CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION`, `RESOURCE_EXHAUSTED`); tarea mensual automática de "mantener vivo" el acceso.
- Conexión a Bing Webmaster Tools: API key; lista de sitios verificados.
- Conexión a Gemini: API key; prueba; aviso sobre uso de datos en el nivel gratuito. Conexión a Ollama: URL local (solo modo servidor).
- Conexión a GA4 (opcional) y carga de logs de servidor (opcional, archivos `.log`/`.gz` subidos a `data/sites/<sitio>/logs/`).
- Panel de salud: última sincronización, cuota consumida/restante por API, errores, créditos de Netlify estimados consumidos en el mes.

### M2 — Rendimiento orgánico (Search Console)

- Backfill inicial de 16 meses, día a día, con dimensiones `date × query × page × country × device` para cada tipo de búsqueda, más una pasada por `searchAppearance`. Paginación de 25.000 filas. El backfill se ejecuta por lotes (un día o un rango por lote) y es reanudable por cursor.
- Sincronización diaria incremental con `dataState=all`; las filas preliminares se reescriben cuando pasan a finales (`es_final`).
- Reporte de IA generativa de Search Console (impresiones en superficies de IA de Google): se consume si la API lo expone (A VERIFICAR); el esquema queda preparado.
- URL Inspection programada de páginas prioritarias dentro de la cuota diaria; Sitemaps.
- Vistas: tablero con comparación de períodos; consultas y páginas con filtros (país, dispositivo, marca/no marca por expresión regular, rango de posición) y deltas; **historial de posición por keyword × país × dispositivo** con mejor posición y cambios de URL; **canibalización** (dos o más páginas alternando para la misma consulta); **quick wins** (posición 4–20, impresiones altas, CTR bajo frente a la curva de CTR propia, sección 10.1); **caídas** (sección 10.5); cobertura de índice.

### M3 — Keywords e intención

- Fuentes: Keyword Planner (ideas por keyword, URL y sitio; históricos en lotes), Search Console (consultas reales del sitio, cruzadas con Keyword Planner para obtener volumen), Bing Webmaster (keywords relacionadas e impresiones), Autocomplete best-effort (expansión alfabética y por modificadores: "cómo", "qué", "precio", "vs", "cerca de", "requisitos", "gratis", "2026"), Gemini (preguntas de comprador, subconsultas de fan-out, sinónimos, entidades; nunca presentadas como volumen), capturas de la extensión (PAA y búsquedas relacionadas reales).
- Intención fraccional (sección 10.2), clustering (sección 10.3), dificultad relativa (sección 10.4), score de oportunidad.
- Vistas: explorador (volumen, tendencia 12 meses, CPC, competencia, intención, clúster, posición actual, dificultad relativa, oportunidad); mapa de clústeres con página asignada o "sin página"; preguntas; gaps; listas con exportación y envío a brief o a seguimiento.

### M4 — Auditoría técnica y de contenido

- Crawler: confirmación de propiedad; robots.txt, velocidad configurable, tope de URLs (5.000 por defecto), canónicas, nofollow, redirecciones. Recolecta por URL: estado, tiempo, tamaño, título, descripción, H1–H6, canónica, meta robots y X-Robots-Tag, hreflang, enlaces internos y externos con anchor y nofollow, imágenes y alt, JSON-LD y microdatos, texto y número de palabras, fechas detectadas, idioma, Open Graph. Render JS con Playwright solo en modo servidor.
- Catálogo de ~120 reglas en `packages/reglas/` (id, categoría, severidad, título, descripción y remediación en español, evidencia): indexabilidad, contenido (títulos, descripciones, H1, contenido delgado por vertical, duplicados por embeddings, antigüedad), enlazado interno (profundidad, huérfanas, anchors, rotos), rendimiento (CrUX y PSI), datos estructurados (sintaxis, tipos recomendados por tipo de página, coherencia con lo visible), **preparación para IA** (robots.txt analizado bot por bot: Googlebot, Bingbot, OAI-SearchBot, GPTBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, CCBot, Bytespider, con explicación de qué implica cada bloqueo; contenido crítico dependiente de JS; controles de preview; respuesta directa al inicio; secciones de 120–180 palabras; estadísticas y citas; fecha visible; headings directos; llms.txt informativo), internacional (hreflang), básicos (HTTPS, mixed content, redirección www, 404 real).
- CrUX diario por origen y semanal por URLs prioritarias (historial de 40 semanas); PSI semanal para las 20 páginas principales con presupuesto configurable.
- Enlazado interno por similitud (sección 10.7).
- Vistas: resumen por severidad; issues con evidencia y botón "crear tarea"; ficha por URL; CWV; preparación para IA; comparación entre crawls (nuevos, resueltos, cambios de título/canónica/estado); reporte HTML autocontenido; CSV.

### M5 — Plan de acción priorizado

- Pantalla principal "Hoy". Tareas generadas desde quick wins, caídas, gaps de contenido, issues de auditoría, gaps de visibilidad en IA, enlazado interno y páginas a refrescar (más de 3–6 meses sin actualizar con tráfico decreciente).
- Cada tarea: tipo, título claro, URLs, evidencia enlazada, impacto estimado (impresiones × diferencia de CTR esperado, sección 10.1), esfuerzo, prioridad = impacto × confianza / esfuerzo, estado (pendiente, en curso, hecha, descartada), fecha, **resultado medido a 28 días** (el sistema vuelve a medir y reporta si mejoró).
- Acciones directas: generar brief, reescribir título y meta, generar FAQs, generar JSON-LD, sugerir enlaces.
- Vista lista y Kanban; filtros; exportación.

### M6 — Contenido SEO/GEO

- Brief a partir de keyword/clúster o URL existente: intención y micro-intenciones; subpreguntas (GSC + Autocomplete + Gemini + PAA capturadas por la extensión); análisis de hasta 10 páginas de referencia públicas indicadas por el usuario o sugeridas desde las citas de IA (Readability: headings, extensión, términos TF-IDF, preguntas, schema, fecha); generación con Gemini del brief completo: título y ángulo sin sobreoptimizar, respuesta directa inicial, secciones de 120–180 palabras, términos y entidades, subpreguntas, **estadísticas a incluir con fuente sugerida**, **citas de expertos sugeridas** (a validar por una persona), FAQs, enlaces internos, JSON-LD, longitud objetivo, llamada a la acción según intención, checklist GEO.
- Borrador completo y reescritura con perfil de voz por sitio, protegiendo los términos por los que la página ya recibe impresiones.
- Scoring SEO y GEO 0–100 (sección 10.8) con desglose de faltantes; lint GEO determinista (~60 reglas).
- Generadores: JSON-LD por tipo de página, FAQs en HTML, llms.txt (con advertencia de efecto no demostrado), robots.txt según política de IA del sitio.
- Biblioteca con estados (brief, borrador, revisado, publicado) y medición a 28/90 días desde la fecha de publicación declarada.

### M7 — Visibilidad en IA (GEO/AEO)

- Prompts por sitio (25–100) en el idioma y país objetivo, de cuatro tipos: descubrimiento ("mejores X en Chile"), comparación ("X vs Y"), confianza ("¿es confiable X?") e informacional ("cómo hacer Z"). Generación asistida desde M3 y edición manual. Volumen del prompt: no existe gratis; se muestra el volumen de la keyword más cercana etiquetado como proxy.
- Motores: **Gemini API** (gratis; con grounding cuando el nivel lo permita, detectado automáticamente), **Ollama** (modo servidor; mide conocimiento paramétrico), **modo manual** (pegar respuestas), **extensión de navegador** (captura respuestas reales de ChatGPT, Gemini, Perplexity y AI Overviews/AI Mode tal como las ve el usuario; sección M9). No se automatizan las interfaces web de consumo desde el servidor.
- Protocolo: cada prompt se ejecuta N veces (3 por defecto) por motor; concurrencia ≤3; reintentos con backoff; celdas fallidas visibles; fila inmutable por corrida × prompt × motor × repetición (respuesta cruda, URLs citadas, modelo, latencia, error).
- Métricas con fórmula documentada y evidencia enlazada: tasa de mención (por alias), tasa de cita (dominio propio, host + ruta canónica sin tracking), posición de primera mención, share of voice, sentimiento (pasada posterior), top 50 fuentes por motor, gaps, afirmaciones incorrectas sobre la marca (citadas textualmente), tendencia semanal, cita vs. mención separadas por motor.
- Fuentes oficiales complementarias: reporte de IA generativa de GSC, Bing AI Performance, canal GA4 de referidos de IA (`chatgpt\.com|perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai`, `utm_source=chatgpt.com`), análisis de logs (bots de IA por URL; lista editable; desconocidos contados).
- Presupuesto: contador de llamadas a Gemini por día frente al límite gratuito; la corrida se detiene y reanuda al día siguiente si se agota.

### M8 — Monitoreo y notificaciones internas (D7)

- Programación en Netlify: sincronización GSC diaria; CrUX diaria (origen) y semanal (URLs); PSI semanal; URL Inspection diaria de páginas nuevas/prioritarias; crawl semanal; corrida de IA semanal; Bing semanal; medición de resultados de tareas diaria.
- Anomalías (sección 10.5): caídas y subidas de clics, impresiones, posición y CTR por página y consulta; cambios de indexación; nuevos errores de crawl; degradación de CWV; pérdida o ganancia de citas/menciones en IA; cambios de título, canónica o robots detectados por crawl diferencial.
- Entrega: campana con contador en la cabecera; sección **"Alertas del día"** por sitio y global, con filtros, estado leído/no leído y silenciamiento por regla; **resumen semanal en pantalla** con los cinco hechos más relevantes y tres tareas sugeridas. Sin correo ni mensajería externa.

### M9 — Captura desde navegador (extensión propia)

Es la pieza que resuelve por código lo que no existe en API gratuita, de forma conforme a los términos de servicio porque captura lo que la persona ya ve en su propio navegador.

- Extensión Manifest V3 para Chrome/Edge (y Firefox si el costo es bajo), publicada en el repositorio para instalación en modo desarrollador (sin tiendas).
- Captura en Google: lista de resultados orgánicos (posición, URL, título, snippet), anuncios marcados, People Also Ask (preguntas y, si están expandidas, respuestas y fuentes), búsquedas relacionadas, featured snippet, AI Overview y AI Mode (texto y referencias), con `gl`/`hl` detectados.
- Captura en ChatGPT, Gemini y Perplexity: prompt, respuesta completa, citas/fuentes visibles, modelo si se muestra, fecha.
- Envío al sistema mediante `POST /api/captura` con token de la extensión; el sistema normaliza y guarda como fila inmutable con origen "captura de navegador".
- Modo "sesión de medición": la extensión recibe del sistema la lista de prompts/keywords pendientes del sitio y guía al usuario para ejecutarlos uno a uno (abre la consulta, captura, pasa a la siguiente), de modo que una persona pueda alimentar 50 prompts en pocos minutos.
- Nunca automatiza clics ni envía consultas por sí sola: la persona ejecuta cada búsqueda.

### M10 — Integración y reportes

- API REST `/api/v1` documentada con OpenAPI, protegida con la contraseña compartida o un token de API definido en entorno.
- Servidor MCP (`packages/mcp`) con herramientas: `get_quick_wins`, `get_keyword_ideas`, `get_page_issues`, `generate_brief`, `score_draft`, `get_ai_visibility`, `list_tasks`, `create_task`, para que agentes de código (Claude Code, Cursor, Codex) trabajen contra el sistema.
- Reportes por sitio y período: HTML autocontenido, CSV y PDF (PDF solo en modo servidor, con Playwright; en Netlify se ofrece HTML imprimible).

---
## 8. Almacenamiento: Excel dentro del proyecto (D3, D5)

### 8.1 Principios

- **REGLA 8.1:** la única fuente de verdad son los archivos `.xlsx` de `data/`. No hay base de datos. Ninguna dependencia de almacenamiento de terceros.
- **REGLA 8.2:** todo acceso a datos pasa por una única capa `lib/almacen/` (interfaz `Almacen`) con operaciones `leerHoja`, `escribirHoja`, `anexarFilas`, `actualizarFilas`, `leerConfig`, `escribirConfig`, `bloquear`, `liberar`. Ningún módulo abre un archivo Excel directamente.
- **REGLA 8.3:** dos implementaciones de `Almacen`, seleccionables por variable de entorno `ALMACEN_MODO`: `local` (escritura directa a disco, para servidor propio y desarrollo) y `git` (persistencia en el repositorio, para Netlify). Mismo comportamiento observable.
- **REGLA 8.4:** cada escritura es atómica (archivo temporal + renombrado en local; commit único en git) y cada hoja tiene columnas `id`, `creado_en`, `actualizado_en`.
- **REGLA 8.5:** las filas de datos externos (Search Console, respuestas de IA, capturas, crawls) son inmutables: se anexan, nunca se sobrescriben. Las hojas de estado (tareas, configuración, notificaciones) sí se actualizan.

### 8.2 Estructura de archivos

```
data/
├─ config.xlsx                      # hojas: sitios, competidores, conexiones (solo referencias, nunca secretos),
│                                   #        prompts_plantilla, reglas_alerta, ajustes, plantillas_vertical
├─ jobs.xlsx                        # hojas: cola (jobs con estado, cursor, intentos), historial, uso_api
├─ notificaciones.xlsx              # hojas: notificaciones (global), lecturas
└─ sites/
   └─ <slug-del-sitio>/
      ├─ gsc_YYYY-MM.xlsx           # un libro por mes: hojas query_page (date,query,page,country,device,type,clicks,
      │                             #   impressions,ctr,position,es_final), appearance, resumen_diario
      ├─ posiciones.xlsx            # hojas: keywords_seguidas, historial (keyword,country,device,date,position,
      │                             #   impressions,clicks,url), mejores
      ├─ inspecciones.xlsx          # URL Inspection y sitemaps
      ├─ keywords.xlsx              # hojas: keywords, volumen_mensual, intencion, clusters, preguntas, listas, gaps
      ├─ auditoria.xlsx             # hojas: crawls, urls, enlaces, issues, cwv, psi, enlazado_sugerido
      ├─ contenido.xlsx             # hojas: briefs, borradores, puntuaciones, publicaciones
      ├─ ia.xlsx                    # hojas: prompts, corridas, respuestas, menciones, citas, fuentes, referidos, bots
      ├─ capturas.xlsx              # capturas de la extensión (serp, paa, aio, chat)
      ├─ tareas.xlsx                # plan de acción y resultados medidos
      ├─ alertas.xlsx               # alertas detectadas por sitio
      ├─ embeddings.bin             # vectores (formato binario propio, índice por id) para no inflar los Excel
      └─ logs/                      # logs de servidor subidos (opcional)
```

### 8.3 Modo `git` (Netlify)

- Las funciones de Netlify leen y escriben los archivos de `data/` a través de la API de GitHub (Contents API para archivos menores de 1 MB; Git Data API — blobs, trees, commits — para archivos mayores), usando un token de acceso con alcance limitado al repositorio, definido en variable de entorno `GITHUB_TOKEN`, y la rama definida en `GITHUB_RAMA_DATOS` (por defecto la misma rama de despliegue).
- Cada commit lleva el prefijo `[datos]` y el sufijo `[skip netlify]` para que Netlify **no** reconstruya el sitio por cada escritura. Las funciones siempre leen la versión más reciente desde GitHub (no la copia del despliegue), con caché en memoria por ejecución y validación por `sha`.
- Concurrencia: la API de GitHub exige el `sha` actual del archivo para escribir; si cambió, se reintenta tras releer (control optimista). Además, `jobs.xlsx` contiene una hoja `bloqueos` con bloqueo por archivo y vencimiento, para que dos funciones no procesen el mismo libro a la vez.
- Lotes: una función agrupa todas sus escrituras y hace un solo commit al terminar (o cada N filas en trabajos largos), para minimizar llamadas (límite de la API de GitHub: 5.000 solicitudes/hora con token).
- Resultado: los datos están siempre dentro de la carpeta `data/` del repositorio, versionados; clonar el repositorio equivale a llevarse todos los datos; mover el sistema a un servidor propio es cambiar `ALMACEN_MODO=local`.

### 8.4 Modo `local` (servidor propio y desarrollo)

- Escritura directa en `data/` con bloqueo por archivo (`proper-lockfile` o equivalente), copia de seguridad rotativa diaria en `data/backups/` (se conservan 14), y comando `seobestia respaldar` que empaqueta `data/` en un zip.

### 8.5 Límites y rendimiento

- Excel admite 1.048.576 filas por hoja; un libro GSC mensual de un sitio grande (consultas × páginas × países × dispositivos) puede superarlo. Por eso el particionado es mensual y, si un mes supera 800.000 filas, se divide en libros por país.
- Lectura: ExcelJS en modo streaming para libros grandes; nunca se carga más de un libro mensual completo en memoria por operación. Las vistas se sirven desde hojas de resumen precalculadas (`resumen_diario`, `mejores`, `gaps`) que se recalculan en el job nocturno, no en la petición.
- Retención configurable por sitio: por defecto se conserva todo; opción de archivar libros anteriores a 24 meses en `data/archivo/`.
- Exportación: cualquier hoja se descarga tal cual (ya es Excel) o como CSV.

---

## 9. Arquitectura técnica

### 9.1 Stack (cerrado)

- **Aplicación:** Next.js (App Router) en TypeScript estricto, desplegado en Netlify con el adaptador oficial; Tailwind CSS + shadcn/ui; Recharts; TanStack Table. Español neutro en toda la interfaz (D8), sin capa de i18n.
- **Funciones de Netlify** en `netlify/functions/`: Scheduled Functions (disparo diario; límite 30 s) que encolan y llaman a Background Functions (hasta 15 minutos, incluidas en el plan gratuito) que procesan los jobs por lotes.
- **Almacenamiento:** Excel en `data/` vía `lib/almacen/` (sección 8). ExcelJS.
- **Acceso:** contraseña única `APP_CONTRASENA` y secreto `APP_SECRETO` para firmar la cookie de sesión (D6). Pantalla de acceso con contraseña; sin usuarios.
- **Crawler:** Crawlee (Cheerio) por lotes en Netlify; Crawlee (Playwright) en modo servidor.
- **IA:** Vercel AI SDK con proveedores Google (Gemini) y Ollama; salida estructurada con Zod; caché de respuestas por hash de prompt en `data/cache/`; registro de llamadas y tokens en `jobs.xlsx/uso_api`.
- **Embeddings:** Gemini embeddings (gratis dentro de límites) almacenados en `embeddings.bin` por sitio; búsqueda por similitud coseno en memoria (volúmenes de decenas de miles de vectores son manejables).
- **Extensión de navegador:** `packages/extension` (Manifest V3, TypeScript).
- **MCP:** `packages/mcp`.
- **Calidad:** ESLint, Prettier, Vitest, Playwright (e2e), GitHub Actions para CI (lint, tests, build, license-checker). CI es opcional para el funcionamiento; no es dependencia de ejecución.
- **Licencia:** MIT.

### 9.2 Diagrama lógico

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Netlify (plan gratuito)  ·  o servidor propio (Docker / Node)            │
│                                                                          │
│  Next.js: UI (español) · API REST /api/v1 · MCP /api/mcp · /api/captura  │
│  netlify/functions: tick (scheduled, diario) ──► run-jobs (background,   │
│                     15 min, se re-encadena mientras queden lotes)        │
│                                                                          │
│  lib/almacen ── modo git  ──► repositorio GitHub (data/*.xlsx, commits)  │
│              └─ modo local ─► disco (data/*.xlsx)                        │
└──────────────┬────────────────────────────────────────┬──────────────────┘
               │ APIs oficiales gratuitas               │ POST /api/captura
   GSC · Google Ads (KP) · PSI · CrUX · GA4 ·     Extensión de navegador
   Bing WMT · IndexNow · Gemini · (Ollama local)  (SERP, PAA, AIO, chats)
```

### 9.3 Sistema de jobs

- Tabla `jobs.xlsx/cola`: `id, tipo, sitio, payload, estado (pendiente|en_curso|hecho|fallido|pausado), cursor, intentos, max_intentos, creado_en, iniciado_en, terminado_en, error, prioridad`.
- Tipos de job: `gsc_backfill`, `gsc_diario`, `gsc_inspeccion`, `kp_ideas`, `kp_historico`, `bing_sync`, `crux`, `psi`, `crawl`, `auditoria_reglas`, `embeddings`, `clustering`, `intencion`, `ia_corrida`, `ia_metricas`, `anomalias`, `tareas_medir`, `resumen_semanal`, `kp_mantener_vivo`, `archivar`.
- **REGLA 9.3:** todo job procesa un lote que termina en menos de 10 minutos, guarda su `cursor` y devuelve "quedan lotes" o "terminado". `run-jobs` toma jobs por prioridad, ejecuta lotes hasta agotar su ventana de 13 minutos (margen sobre 15), escribe los Excel (un commit en modo git) y, si queda trabajo, se vuelve a invocar a sí misma por HTTP (encadenado), con un máximo de encadenamientos por día definido en `ajustes` para respetar los créditos de Netlify.
- Scheduled Function `tick` (diaria, hora configurable, UTC): crea los jobs del día según el calendario de cada sitio y dispara `run-jobs`. Un botón "Ejecutar ahora" en la interfaz crea el job y dispara `run-jobs` de inmediato.
- Idempotencia: cada lote verifica por `id` o por clave natural (`date+query+page+country+device`) antes de anexar.
- Reintentos: 3 intentos con backoff exponencial; ante 429 de una API se pausa el job hasta el próximo tick y se registra en `uso_api`.
- En modo servidor: el mismo código corre como proceso `seobestia worker` con un planificador interno (cron en proceso) y sin límite de 15 minutos; Playwright habilitado.

### 9.4 Seguridad

- Secretos solo en variables de entorno (`.env` local; panel de Netlify en despliegue): `APP_CONTRASENA`, `APP_SECRETO`, `GITHUB_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`, `GOOGLE_ADS_*`, `GEMINI_API_KEY`, `BING_API_KEY`, `PSI_API_KEY`, `CRUX_API_KEY`, `EXTENSION_TOKEN`, `API_TOKEN`, `ALMACEN_MODO`. `.env.example` documenta cada una. Los Excel nunca contienen secretos.
- Sesión por cookie firmada (HttpOnly, Secure, SameSite=Lax), expiración configurable, limitación de intentos de acceso.
- `/api/captura` y `/api/v1` autenticadas por token; limitación de tasa.
- Confirmación de propiedad antes de rastrear; respeto estricto de robots.txt.
- Sin telemetría.

### 9.5 Presupuesto del plan gratuito de Netlify (A VERIFICAR en netlify.com/pricing)

- 300 créditos/mes; cada despliegue de producción consume 15; cómputo de funciones 10 créditos por GB-hora; ancho de banda 20 créditos por GB; 2 créditos por 10.000 solicitudes.
- Una Background Function de 15 minutos a 1 GB consume 0,25 GB-h ≈ 2,5 créditos. Presupuesto de referencia: 2 despliegues/mes (30) + 60 ejecuciones de background de 15 min (150) + navegación interna (≈ 20) deja margen. Por eso la frecuencia es **diaria** para sincronizaciones y **semanal** para crawls y corridas de IA, y el límite de encadenamientos diarios por defecto es 3.
- El panel de salud muestra el consumo estimado del mes y avisa al 80%.
- Las funciones síncronas (60 s) sirven solo la interfaz y la API; ningún trabajo pesado corre en ellas.

### 9.6 Captura automatizada best-effort (solo modo servidor)

Módulo `lib/captura-automatica/`, desactivado por defecto y **no disponible en Netlify**:

- Usa Crawlee + Playwright con un navegador real, un perfil persistente, una consulta por vez, pausas aleatorias de 20–60 segundos, máximo 100 consultas por día por sitio, `gl`/`hl` por país, y se detiene ante cualquier captcha o página de consentimiento.
- Extrae lo mismo que la extensión (orgánicos, PAA, relacionadas, AI Overview) y guarda con origen "captura automática".
- La interfaz muestra un aviso permanente: esta captura no se basa en una API y puede contravenir los términos de servicio de Google; se ofrece para servidores propios bajo responsabilidad del operador; la extensión de navegador (M9) es la vía recomendada.

---

## 10. Metodologías y algoritmos

### 10.1 Curva de CTR propia e impacto estimado

Por sitio, país y dispositivo: CTR esperado por posición = mediana del CTR observado en las filas de GSC por posición redondeada, con mínimo 50 consultas por punto; si no hay datos suficientes, curva genérica documentada y etiquetada. Impacto de una tarea = impresiones × (CTR esperado en posición objetivo − CTR actual). Se recalcula en el job nocturno y se guarda en `resumen_diario`.

### 10.2 Clasificación de intención

Salida por keyword: vector {informacional, navegacional, comercial, transaccional} que suma 1; micro-intenciones (lista abierta por vertical: urgente, requisitos, precio, plazo, "cómo saber si", vs, cerca de, gratis, plantilla, año); confianza; propensión a IA (las informacionales simples disparan AI Overviews y devuelven menos clics).

Tres capas: (1) reglas y diccionarios por idioma (es-CL, es-PE, es-419, pt-BR, en); (2) señales de GSC: tipo de página propia que rankea para la consulta, inferido por el crawler (ficha de servicio, artículo, home, categoría); (3) Gemini con definición de intenciones, micro-intenciones del vertical, 10 ejemplos del propio sitio y salida JSON estricta. El modelo propone; las capas 1–2 filtran; fusión ponderada configurable. Evaluación: `fixtures/intencion/` con 200 keywords etiquetadas por vertical y test que exige F1 ≥ 0,75.

### 10.3 Clustering temático

(1) Embeddings de Gemini por keyword; (2) grafo de solapamiento desde GSC: dos consultas con la misma URL ganadora en el mismo país en 90 días reciben una arista con peso = impresiones compartidas (es el reemplazo gratuito del "SERP overlap" de las suites de pago y refleja cómo Google agrupa de verdad las consultas del sitio); (3) clustering jerárquico sobre similitud combinada (0,6 embeddings + 0,4 grafo; 1,0 embeddings sin datos de GSC); (4) nombre del clúster y keyword principal con Gemini; (5) asignación clúster → página propia o "sin página" (gap). Las capturas de la extensión (resultados reales) enriquecen el grafo cuando existen.

### 10.4 Dificultad relativa al sitio

0–100, etiquetada como estimación: posición actual del sitio para la keyword y su clúster, competencia y CPC de Keyword Planner, proporción transaccional, enlaces entrantes propios (Bing), y, si hay capturas de SERP de la extensión, dominios presentes en los resultados.

### 10.5 Detección de caídas y anomalías

Series diarias por página y consulta (clics, impresiones, posición, CTR). Media móvil de 7 días frente a los 7 anteriores y frente a la misma ventana del año anterior; alerta cuando el cambio supera el umbral (por defecto −30% clics con base ≥50, −20% impresiones, +3 posiciones, −25% CTR) y además supera 2 desviaciones estándar de la variación semanal histórica. Cada alerta enlaza las filas y sugiere causas por correlación temporal: cambio de título/canónica/estado en el crawl, pérdida de indexación, cambio de URL ganadora, degradación de CWV, nuevos competidores citados en IA.

### 10.6 Crawler por lotes

Cola de URLs en `auditoria.xlsx/urls` con estado; cada lote procesa 40 URLs (concurrencia 5, 10 s por URL) y guarda; la Background Function encadena lotes hasta su ventana; el crawl de 5.000 URLs se completa en varias ejecuciones y la interfaz muestra el avance. En modo servidor, sin lotes y con render JS.

### 10.7 Enlazado interno sugerido

Chunks de 200–300 palabras por página con embeddings; para cada página destino se proponen enlaces desde las páginas más similares que aún no la enlazan, con anchor tomado de las consultas por las que el destino ya recibe impresiones; prioridad a destinos con quick wins; se excluyen noindex; máximo N sugerencias por página origen.

### 10.8 Puntuación SEO y GEO (0–100 cada una), pesos en `docs/puntuacion.md`

- SEO: cobertura de términos del clúster 25; subpreguntas 15; estructura y longitud frente a referencias 15; título y meta 10; enlazado y canónica 10; datos estructurados 10; frescura 5; CWV de la URL 10; sobreoptimización hasta −15.
- GEO: respuesta directa al inicio 15; secciones autocontenidas de 120–180 palabras 15; estadísticas con fuente 15; citas de expertos o fuentes 15; headings directos y claridad 10; frescura < 3 meses con fecha visible 10; accesibilidad para bots de búsqueda de IA y sin dependencia de JS 10; entidades y coherencia de marca 5; llms.txt y schema coherente 5 (informativo).

Los pesos provienen de la evidencia resumida en la sección 12 y se revisan semestralmente.

---

## 11. Procedimientos de habilitación (se documentan con capturas en `docs/conexiones/`)

### 11.1 Google Cloud y service account (Search Console, GA4, PSI, CrUX)

1. Crear un proyecto en Google Cloud Console.
2. Habilitar las APIs: Google Search Console API, Google Analytics Data API, PageSpeed Insights API, Chrome UX Report API.
3. Crear una service account y descargar su clave JSON; guardarla en base64 en `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`. (Organizaciones de Google Cloud creadas después de mayo de 2024 pueden tener bloqueada la creación de claves por política; en ese caso, desactivar la restricción `iam.disableServiceAccountKeyCreation` para el proyecto.)
4. Crear una API key restringida a PSI y CrUX; guardarla en `PSI_API_KEY` y `CRUX_API_KEY`.
5. En Search Console, agregar el correo de la service account como usuario con permiso "Completo" en cada propiedad. En GA4, como lector de la propiedad.
6. En SEOBESTIA, el asistente detecta el acceso y lanza el backfill.

### 11.2 Google Ads API — Keyword Planner (nivel Basic)

1. Tener una cuenta de Google Ads de producción (que sirva o haya servido anuncios reales). Las cuentas de prueba devuelven datos ficticios. Ya no es obligatoria una cuenta de administrador (MCC).
2. En el mismo proyecto de Google Cloud, habilitar Google Ads API.
3. Crear credenciales OAuth de tipo "Aplicación de escritorio" y ejecutar una sola vez, en un computador, el script `scripts/google-ads-token.ts` del repositorio, que abre el navegador, pide consentimiento con el scope `adwords` y devuelve un refresh token; guardarlo en `GOOGLE_ADS_REFRESH_TOKEN` junto con `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` y `GOOGLE_ADS_CUSTOMER_ID`. (Alternativa: service account con impersonación si la cuenta pertenece a Google Workspace.)
4. En la página "Google Ads API Overview" del proyecto de Cloud, el nivel inicial es Test. Solicitar Explorer (revisión automatizada) y luego **Basic**, que exige **verificación de marca** del proyecto (sitio público, política de privacidad, dominios verificados en Search Console). Explorer **no** permite Keyword Planner.
5. En SEOBESTIA, probar la conexión: el asistente ejecuta una idea de keyword y muestra el volumen devuelto. Si la API devuelve rangos en lugar de números, el sistema lo indica (A VERIFICAR con la cuenta real).
6. El job `kp_mantener_vivo` ejecuta una consulta mínima mensual para evitar la revocación por 90 días de inactividad.

### 11.3 Bing Webmaster Tools e IndexNow

1. Verificar los sitios en Bing Webmaster Tools (se puede importar desde Search Console).
2. Generar la API key en Configuración → Acceso a API; guardarla en `BING_API_KEY`.
3. Para IndexNow, SEOBESTIA genera la clave y muestra el archivo `/{clave}.txt` que debe publicarse en la raíz del sitio.

### 11.4 Gemini

1. Crear una API key en Google AI Studio; guardarla en `GEMINI_API_KEY`.
2. Confirmar en AI Studio los límites del nivel gratuito del modelo elegido y registrarlos en `ajustes` (el sistema los usa como presupuesto diario).

### 11.5 GitHub (modo `git` para Netlify)

1. Crear un token de acceso de grano fino con permiso de lectura y escritura de contenidos solo sobre el repositorio `seobestia`; guardarlo en `GITHUB_TOKEN`.
2. Definir `GITHUB_REPO`, `GITHUB_RAMA_DATOS` y `ALMACEN_MODO=git` en las variables de entorno de Netlify.
3. Configurar en Netlify el build para ignorar commits con `[skip netlify]` (comportamiento nativo).

### 11.6 Netlify

1. Importar el repositorio; build con el adaptador de Next.js; definir todas las variables de entorno de `.env.example`.
2. Verificar que las Scheduled Functions aparecen en el panel y que `tick` tiene la expresión cron diaria.
3. Ejecutar "Ejecutar ahora" en el panel de salud y comprobar que `run-jobs` completa un lote y que aparece el commit `[datos]` en el repositorio.

---
## 12. Evidencia GEO/AEO que fundamenta el scoring y las reglas (2025–2026)

Resumen de los estudios usados; las fuentes están en la sección 20.

- La correlación entre rankear en Google y ser citado en AI Overviews cayó de 76% a 38% de citas desde el top-10 entre 2025 y 2026; en AI Mode, el 88% de las citas no rankea para la consulta exacta. Causa: *query fan-out*. Regla derivada: cubrir el clúster de subpreguntas, no una keyword.
- Evidencia experimental (paper GEO, Princeton/Georgia Tech): añadir citas de fuentes (+40% de visibilidad), estadísticas (+30%), citar fuentes (+25–30%), fluidez (+25–30%); el keyword stuffing baja la visibilidad; las tácticas benefician más a sitios peor posicionados.
- Evidencia correlacional (SE Ranking, 129.000 dominios): secciones de 120–180 palabras, citas de expertos, 19+ datos estadísticos, actualización en menos de 3 meses, headings directos (no en forma de pregunta), FCP < 0,4 s, presencia en Reddit, Quora y plataformas de reseñas. Títulos y URLs sobreoptimizados citan menos; FAQ schema no ayuda; llms.txt no tiene efecto.
- Menciones de marca en terceros correlacionan con visibilidad en IA tres veces más que los backlinks (Ahrefs, 75.000 marcas: 0,664 frente a 0,218).
- Frescura: los asistentes de IA citan contenido 25,7% más reciente que el top-10 orgánico; ChatGPT es el más sensible a la frescura; AI Overviews, la excepción.
- "Ghost citations" (Semrush): 61,7% de las apariciones son citas sin mención; ChatGPT cita mucho y nombra poco, Gemini nombra mucho y cita poco. Regla derivada: medir cita y mención por separado y por motor.
- llms.txt: 97% de los archivos recibe cero solicitudes; ningún motor confirma su uso. Se ofrece como utilidad, sin promesa.
- Crawlers: el índice de búsqueda de cada proveedor usa bots distintos de los de entrenamiento (OAI-SearchBot ≠ GPTBot; Claude-SearchBot ≠ ClaudeBot; Google-Extended no afecta AI Overviews). Regla derivada: la auditoría explica bot por bot qué implica cada bloqueo.
- Google (guía oficial, mayo de 2025): no hay requisitos extra para AI Overviews/AI Mode; aplican los controles de preview y la calidad habitual; el schema debe ser coherente con lo visible.
- Tipos de contenido más citados: listicles y comparativas en ChatGPT; contenido editorial 53,5% de las citas; las páginas de producto aparecen mucho y se citan poco.

---

## 13. Experiencia de usuario

- Pantalla principal por sitio: **"Hoy"** con tres bloques: qué cambió (alertas del día), qué hacer (tareas priorizadas), qué medimos (resumen GSC + visibilidad en IA).
- Etiqueta de origen en cada dato: "Oficial · Search Console", "Oficial · Keyword Planner", "Estimación · SEOBESTIA", "IA · Gemini", "Captura · navegador".
- Todo agregado se abre hasta la fila cruda. Tooltips con definición y fórmula en cada métrica.
- Estados vacíos que explican qué conectar y qué habilita cada conexión.
- Accesibilidad AA: teclado, contraste, foco visible, etiquetas.
- Navegación:

```
/acceso                      → contraseña compartida
/                            → tarjetas de sitios (salud, tendencia, alertas)
/[sitio]                     → Hoy
/[sitio]/rendimiento         → resumen · consultas · páginas · posiciones · canibalización · cobertura · IA generativa
/[sitio]/keywords            → explorador · clústeres · preguntas · gaps · listas
/[sitio]/auditoria           → resumen · issues · URLs · CWV · preparación IA · comparar crawls
/[sitio]/contenido           → briefs · borradores · puntuación · generadores
/[sitio]/ia                  → prompts · corridas · menciones y citas · fuentes · gaps · referidos · bots
/[sitio]/alertas             → alertas del día · historial · reglas
/[sitio]/reportes            → HTML · CSV · PDF (servidor)
/[sitio]/configuracion       → datos · conexiones · competidores · marca y voz · política de bots · presupuesto IA
/sistema                     → salud de conexiones · jobs · créditos Netlify · extensión · API y MCP · respaldo
```

- Onboarding (objetivo: menos de 10 minutos): acceso → añadir sitio (dominio, país, idioma, vertical) → agregar la service account a Search Console (detección automática) → pegar clave de Gemini → opcionales "después" (Keyword Planner, Bing, GA4) → el sistema lanza backfill, crawl e intención y muestra el primer "Hoy" cuando hay al menos 7 días sincronizados, mientras los 16 meses siguen cargando.
- Identidad visual: tema neutro de shadcn/ui; nombre SEOBESTIA y lema "SEO · GEO · AEO" en la cabecera; sin más decisiones de marca en esta versión.

---

## 14. Etapas de construcción (orden obligatorio, sin plazos)

Cada etapa termina con sus criterios de aceptación cumplidos, tests en verde y el sistema desplegado en Netlify. No se inicia una etapa sin cerrar la anterior.

### Etapa 0 — Cimientos
Monorepo (sección 16); Next.js en Netlify; acceso por contraseña; capa `Almacen` con modos `local` y `git`, bloqueos y escritura atómica; `config.xlsx`, `jobs.xlsx` y `notificaciones.xlsx`; sistema de jobs con `tick` y `run-jobs` encadenada; panel `/sistema`; `.env.example`; CI; README con pasos de despliegue en Netlify y en servidor propio.
Aceptación: desplegado en Netlify; un job de prueba escribe una fila y aparece el commit `[datos]`; en modo local escribe en disco; la interfaz muestra la fila.

### Etapa 1 — Rendimiento orgánico (M2)
Conector GSC por service account; backfill por lotes reanudable; sincronización diaria; libros mensuales; `resumen_diario`; URL Inspection; Sitemaps; vistas completas; curva de CTR propia; canibalización; quick wins; exportación.
Aceptación: backfill de un sitio con más de 1 millón de filas completado en varias ejecuciones sin superar cuotas; quick wins con evidencia; 20 quick wins detectados en un sitio con 12 meses de historial.

### Etapa 2 — Plan de acción y notificaciones (M5 + M8)
Motor de tareas; impacto estimado; medición a 28 días; anomalías; campana; "Alertas del día"; resumen semanal en pantalla; vista "Hoy".
Aceptación: alerta de caída registrada en menos de 24 horas desde la disponibilidad del dato en GSC; cada tarea enlaza su evidencia.

### Etapa 3 — Keywords e intención (M3)
Conector Google Ads con asistente y `kp_mantener_vivo`; Bing; Autocomplete best-effort; clasificador de intención con fixtures (F1 ≥ 0,75); embeddings; clustering con grafo GSC; explorador, clústeres, preguntas, gaps, listas.
Aceptación: universo de 2.000 keywords con volumen real para un sitio dentro de las cuotas diarias; clustering determinista sobre fixtures.

### Etapa 4 — Auditoría (M4)
Crawler por lotes; modo servidor con Playwright; catálogo de ~120 reglas; CrUX; PSI; preparación para IA; enlazado interno; comparación de crawls; reporte HTML; CSV.
Aceptación: crawl de 5.000 URLs completado en Netlify en ejecuciones encadenadas; cada regla probada contra el sitio de fixtures (60 páginas con 30 problemas conocidos).

### Etapa 5 — Contenido (M6)
Capa de IA (Gemini/Ollama) con caché y presupuesto; briefs; borradores y reescrituras; scoring SEO y GEO; lint GEO; generadores; biblioteca; medición a 28/90 días.
Aceptación: brief con todos los elementos de M6; scoring reproducible sobre fixtures de borradores buenos y malos.

### Etapa 6 — Captura desde navegador (M9)
Extensión MV3; `POST /api/captura`; normalización a `capturas.xlsx`; modo "sesión de medición"; uso de capturas en posiciones, PAA, clustering y visibilidad en IA.
Aceptación: una persona captura 50 consultas de Google y 20 respuestas de ChatGPT en una sesión guiada y todo aparece en el sistema con evidencia.

### Etapa 7 — Visibilidad en IA (M7)
Prompts; corridas con Gemini, Ollama y modo manual; métricas; gaps; fuentes; sentimiento; GSC IA generativa; Bing AI Performance; canal GA4; análisis de logs; presupuesto.
Aceptación: corrida de 50 prompts × 3 repeticiones en Gemini completada dentro del límite gratuito en una o más ejecuciones; métricas con evidencia; gaps listados.

### Etapa 8 — Integración, modo servidor y cierre (M10)
API REST con OpenAPI; MCP; reportes; Docker y `seobestia worker` con planificador interno; captura automatizada best-effort (desactivada por defecto); respaldo y restauración; documentación completa con capturas; pruebas e2e de onboarding → Hoy → brief → corrida de IA → captura.
Aceptación: el mismo repositorio corre en Netlify (modo git) y en Docker (modo local) sin cambios de código; e2e en verde.

### Etapa 9 — Piloto interno
Conectar los sitios reales, ejecutar durante al menos un ciclo de 28 días, revisar pesos de scoring y umbrales con datos reales, registrar aprendizajes en `docs/DECISIONES.md`.

---

## 15. Prompts de construcción para agentes de código

Se usan en orden, uno por etapa, dentro del repositorio, con el documento completo disponible en `docs/INSTRUCCIONES.md`. El prompt de contexto se antepone siempre.

### 15.0 Prompt de contexto

```
Eres el ingeniero principal de SEOBESTIA, una plataforma open source (MIT) de SEO/GEO/AEO
descrita en docs/INSTRUCCIONES.md. Lee ese documento completo antes de escribir código y
respeta sus decisiones D1–D13 y sus reglas.

Reglas obligatorias:
- Next.js App Router, TypeScript estricto, Tailwind, shadcn/ui. Interfaz solo en español
  neutro.
- Sin base de datos externa. Toda lectura y escritura de datos pasa por lib/almacen
  (archivos .xlsx en data/, modos local y git). Nunca abras un Excel fuera de esa capa.
- Cero APIs de pago. Solo APIs oficiales gratuitas y software open source con licencia
  MIT/Apache/BSD. Nada de AGPL/GPL. Lo que no exista gratis se construye por código.
- Todo trabajo de fondo es un job por lotes, idempotente, reanudable por cursor, que termina
  en menos de 10 minutos; se ejecuta en Netlify Background Functions encadenadas o en el
  worker de servidor. Ningún proceso residente en Netlify. Ninguna función síncrona hace
  trabajo pesado.
- Secretos solo en variables de entorno; entrega .env.example; nunca en logs ni en Excel.
- Filas de datos externos inmutables; toda métrica agregada enlaza a sus filas.
- Etiqueta el origen de cada dato: Oficial (fuente), Estimación, IA, Captura.
- Concurrencia limitada por proveedor, reintentos con backoff ante 429/5xx, celdas fallidas
  visibles, registro de uso de cuota por conector.
- Estados vacío, cargando, éxito y error recuperable en cada vista; validación con Zod;
  modo degradado explicado cuando una API no está disponible.
- Notificaciones solo dentro del sistema (campana y Alertas del día). Sin correo ni webhooks.
- Acceso por contraseña única; sin cuentas ni roles.
- Tests con Vitest sobre transformaciones y fixtures; un test e2e con Playwright del flujo de
  la etapa. Termina ejecutando lint, tests y build, corrige errores en lugar de describirlos y
  lista los comandos exactos usados.
```

### 15.1 Etapa 0

```
Crea el monorepo de la sección 16 del documento. Implementa: acceso por contraseña
(APP_CONTRASENA) con cookie firmada (APP_SECRETO), limitación de intentos y cierre de sesión;
la capa lib/almacen con la interfaz Almacen (leerHoja, escribirHoja, anexarFilas,
actualizarFilas, leerConfig, escribirConfig, bloquear, liberar) y dos implementaciones:
local (ExcelJS, archivo temporal + renombrado, bloqueo por archivo, respaldo rotativo) y git
(API de GitHub: Contents API para archivos < 1 MB y Git Data API para mayores; commits con
prefijo [datos] y sufijo [skip netlify]; control optimista por sha; un commit por lote;
hoja bloqueos en jobs.xlsx). Crea data/config.xlsx, data/jobs.xlsx y
data/notificaciones.xlsx con sus hojas (sección 8.2). Implementa el sistema de jobs (sección
9.3): netlify/functions/tick (scheduled, diaria) y run-jobs (background, ventana de 13
minutos, encadenado con tope diario de ajustes), más el comando `seobestia worker` para modo
servidor. Página /sistema con salud, jobs, créditos estimados y botón Ejecutar ahora.
.env.example, netlify.toml, Dockerfile, compose.yml, CI con lint, tests, build y
license-checker. README con despliegue en Netlify y en servidor propio. Tests: capa almacen
en ambos modos (con mock de GitHub), bloqueos, jobs con cursor, acceso.
```

### 15.2 Etapa 1

```
Implementa el conector de Google Search Console por service account
(GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) con detección automática de acceso a la propiedad.
Backfill de 16 meses por lotes reanudables (un día por lote; paginación de 25.000 filas con
startRow) para los tipos web, discover, googleNews, image y video, con dimensiones date,
query, page, country, device, y una pasada separada por searchAppearance; libros mensuales
data/sites/<slug>/gsc_YYYY-MM.xlsx con división por país si un mes supera 800.000 filas.
Sincronización diaria con dataState=all y marca es_final. Respeta 1.200 consultas/min por
sitio y registra uso_api. Hoja resumen_diario recalculada en job nocturno. URL Inspection
programada (≤2.000/día/sitio) y Sitemaps en inspecciones.xlsx. Vistas: tablero con
comparación de períodos, consultas, páginas, historial de posición por keyword × país ×
dispositivo (posiciones.xlsx), canibalización, quick wins con curva de CTR propia (sección
10.1), cobertura, exportación CSV. Fixtures: 90 días sintéticos con 300 consultas y 40
páginas. Tests: paginación, particionado, curva CTR, canibalización, idempotencia por clave
natural.
```

### 15.3 Etapa 2

```
Implementa el motor de tareas (tareas.xlsx) desde quick wins y caídas con impacto estimado,
esfuerzo, prioridad, evidencia enlazada, estados y medición automática del resultado a 28
días. Implementa la detección de anomalías de la sección 10.5 y las reglas por sitio
(config.xlsx/reglas_alerta). Implementa las notificaciones internas: campana con contador,
sección Alertas del día por sitio y global, leído/no leído, silenciamiento, resumen semanal
en pantalla. Vista Hoy con alertas, tareas y resumen. Tests: anomalías con series de
fixtures (estacionalidad, ruido alto, caída real), prioridad, medición a 28 días.
```

### 15.4 Etapa 3

```
Implementa el conector de Google Ads API para Keyword Planner (generateKeywordIdeas con
semillas de keyword, URL y sitio; generateKeywordHistoricalMetrics en lotes de hasta 10.000)
con el script scripts/google-ads-token.ts, el asistente de habilitación de la sección 11.2,
prueba de conexión, límite de 1 solicitud/segundo, contador diario y el job
kp_mantener_vivo mensual. Conector de Bing Webmaster Tools (REST, API key) para keywords
relacionadas e impresiones. Conector de Google Autocomplete best-effort con caché, backoff,
etiqueta "no oficial" y desactivable. Clasificador de intención de la sección 10.2 con
fixtures/intencion (200 keywords por vertical) y test F1 ≥ 0,75. Embeddings de Gemini en
embeddings.bin por sitio. Clustering de la sección 10.3 con grafo de solapamiento de GSC.
Dificultad relativa y score de oportunidad. Vistas: explorador, clústeres, preguntas, gaps,
listas, envío a brief y a seguimiento. Plantillas por vertical (legal, e-commerce, SaaS,
local, genérica) en config.xlsx/plantillas_vertical. Tests: fusión de intención, clustering
determinista, manejo de RESOURCE_EXHAUSTED, lotes de históricos.
```

### 15.5 Etapa 4

```
Implementa el crawler con Crawlee: modo lotes (CheerioCrawler, cola en auditoria.xlsx/urls,
40 URLs por lote, encadenado) y modo servidor (PlaywrightCrawler con render JS). Exige
confirmación de propiedad; respeta robots.txt, velocidad, canónicas, nofollow, redirecciones
y tope de URLs. Recolecta los campos de M4. Implementa packages/reglas con ~120 reglas (id,
categoría, severidad, título, descripción y remediación en español, evidencia), incluido el
bloque de preparación para IA con análisis de robots.txt bot por bot (lista de la sección
M4), dependencia de JS, controles de preview, respuesta directa, secciones de 120–180
palabras y fecha visible. Integra CrUX (origen diario, URLs prioritarias semanal, historial
40 semanas) y PageSpeed Insights (20 páginas principales, semanal, presupuesto). Sugerencias
de enlazado interno de la sección 10.7. Vistas: resumen, issues con evidencia y botón crear
tarea, ficha por URL, CWV, preparación IA, comparación de crawls, reporte HTML autocontenido,
CSV. Fixtures: sitio estático de 60 páginas con 30 problemas conocidos. Tests: cada regla
contra el fixture; parser de robots.txt por bot; reanudación del crawl por cursor.
```

### 15.6 Etapa 5

```
Implementa la capa de IA con el Vercel AI SDK y registro de proveedores (Gemini por defecto;
Ollama en modo servidor), salida estructurada con Zod, caché por hash en data/cache y
presupuesto diario desde ajustes. Brief según M6: intención, subpreguntas (GSC + Autocomplete
+ Gemini + capturas), análisis de hasta 10 páginas de referencia públicas con Readability,
y generación del brief completo (respuesta directa, secciones de 120–180 palabras, términos
y entidades, estadísticas con fuente sugerida, citas de expertos sugeridas, FAQs, enlaces
internos, JSON-LD con schema-dts, longitud, CTA, checklist GEO). Borrador y reescritura con
perfil de voz por sitio y protección de términos que ya reciben impresiones. Scoring SEO y
GEO 0–100 de la sección 10.8 con desglose; lint GEO determinista de ~60 reglas. Generadores
de JSON-LD, FAQs, llms.txt (con advertencia) y robots.txt según política de bots del sitio.
Biblioteca (contenido.xlsx) con estados y medición a 28/90 días. Tests: scoring y lint sobre
fixtures de borradores buenos y malos; parser de referencias; caché.
```

### 15.7 Etapa 6

```
Implementa packages/extension (Manifest V3, TypeScript): scripts de contenido para Google
(orgánicos con posición, URL, título y snippet; anuncios marcados; People Also Ask con
respuestas y fuentes si están expandidas; búsquedas relacionadas; featured snippet; AI
Overview y AI Mode con texto y referencias; gl/hl), ChatGPT, Gemini y Perplexity (prompt,
respuesta completa, citas visibles, modelo si se muestra, fecha). Popup con token y URL del
sistema, botón Capturar y modo Sesión de medición que recibe de /api/captura/pendientes la
lista de consultas y prompts del sitio y guía a la persona una a una sin automatizar clics
ni envíos. Endpoint POST /api/captura autenticado por EXTENSION_TOKEN que normaliza y anexa
a capturas.xlsx como filas inmutables con origen captura de navegador. Integra las capturas
en posiciones (posición observada), PAA (preguntas), clustering (grafo) y visibilidad en IA
(respuestas reales). Tests: parsers de cada sitio con fixtures HTML guardados; normalización.
```

### 15.8 Etapa 7

```
Implementa M7 completo: prompts por sitio (cuatro tipos, generación asistida, edición);
corridas programadas con N repeticiones (3 por defecto) contra Gemini (con grounding si el
nivel lo permite, detectado automáticamente), Ollama y modo manual; integración de las
capturas de la extensión como motor "navegador"; filas inmutables en ia.xlsx (respuestas,
menciones, citas); normalización de URLs (host + ruta canónica sin parámetros de tracking);
detección de menciones por alias con offset; sentimiento en pasada posterior; métricas con
fórmulas documentadas (mención, cita, share of voice, fuentes top 50, gaps, afirmaciones
incorrectas), separadas por motor; tendencia semanal; presupuesto diario de Gemini con pausa
y reanudación. Integra el reporte de IA generativa de Search Console si la API lo expone,
Bing AI Performance, el canal GA4 de referidos de IA y el análisis de logs con lista
editable de user agents (desconocidos contados). Vistas: prompts, corridas, menciones y
citas, fuentes, gaps, referidos, bots. Fixtures: 30 respuestas sintéticas por motor. Tests:
menciones, normalización, métricas, parser de logs, reanudación por presupuesto.
```

### 15.9 Etapa 8

```
Expón la API REST /api/v1 con OpenAPI y token API_TOKEN; implementa packages/mcp con las
herramientas get_quick_wins, get_keyword_ideas, get_page_issues, generate_brief,
score_draft, get_ai_visibility, list_tasks y create_task; reportes HTML, CSV y PDF (PDF
solo en modo servidor); comando seobestia worker con planificador interno y Playwright;
módulo lib/captura-automatica desactivado por defecto, solo en modo servidor, con los
límites y el aviso de la sección 9.6; comandos seobestia respaldar y seobestia restaurar;
documentación completa en docs/ con capturas de cada conexión; pruebas e2e de onboarding →
Hoy → brief → corrida de IA → captura. Verifica que el mismo repositorio corre en Netlify
(ALMACEN_MODO=git) y en Docker (ALMACEN_MODO=local) sin cambios de código.
```

---

## 16. Estructura del repositorio

```
seobestia/
├─ app/                        # Next.js App Router (UI en español + /api)
│  ├─ (acceso)/acceso/
│  ├─ [sitio]/{rendimiento,keywords,auditoria,contenido,ia,alertas,reportes,configuracion}/
│  ├─ sistema/
│  └─ api/{v1,mcp,captura,jobs}/
├─ netlify/functions/          # tick.ts (scheduled), run-jobs-background.ts
├─ lib/
│  ├─ almacen/                 # interfaz Almacen + local.ts + git.ts + esquemas de hojas
│  ├─ jobs/                    # cola, lotes, encadenado, planificador de servidor
│  ├─ conectores/              # gsc, googleAds, psi, crux, ga4, bing, indexnow, gemini, ollama, autocomplete
│  ├─ crawler/                 # Crawlee, extractores
│  ├─ intencion/ · clustering/ · puntuacion/ · visibilidad-ia/ · alertas/ · captura-automatica/
│  └─ ia/                      # AI SDK, proveedores, caché, presupuesto
├─ packages/
│  ├─ reglas/                  # catálogo de reglas de auditoría y lint GEO (JSON + docs)
│  ├─ extension/               # extensión de navegador (MV3)
│  └─ mcp/                     # servidor MCP
├─ data/                       # Excel (sección 8.2) — se versiona en git
├─ scripts/                    # google-ads-token.ts, respaldar.ts, restaurar.ts, worker.ts
├─ fixtures/                   # intencion/, sitio-auditoria/, respuestas-ia/, gsc/, serp-html/
├─ docs/                       # INSTRUCCIONES.md (este documento), conexiones/, puntuacion.md,
│                              # api.md, DECISIONES.md, referencias/canivibecodeit/
├─ tests/                      # vitest + playwright
├─ netlify.toml · Dockerfile · compose.yml · .env.example · LICENSE (MIT) · README.md
```

---

## 17. Criterios de calidad

- Cobertura de tests unitarios ≥ 70% en `lib/`; 100% en normalización de URLs, detección de menciones, curva CTR, anomalías, scoring, lint y capa `Almacen`.
- Fixtures versionados para cada fuente externa (respuestas reales anonimizadas de GSC, Keyword Planner, CrUX, PSI, Bing, Gemini; HTML de Google, ChatGPT, Gemini y Perplexity para la extensión).
- Pruebas de cuota: simulación de 429 y agotamiento diario con degradación visible.
- Pruebas e2e por etapa contra el despliegue de vista previa de Netlify.
- Revisión de accesibilidad (axe) en las vistas principales.
- Rendimiento de la interfaz: el tablero de un sitio con 16 meses de datos carga en menos de 2,5 s gracias a las hojas de resumen; ninguna vista lee un libro mensual completo en la petición.
- Documentación: cada conexión con capturas; cada métrica con fórmula; cada regla con remediación.

---

## 18. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Keyword Planner no aprueba Basic o devuelve rangos | Asistente de habilitación; modo degradado con GSC + Bing + Autocomplete; indicación explícita en la interfaz |
| Cambios de cuotas o endpoints de Google/Bing | Conectores aislados, versiones de API fijadas, pruebas de contrato, panel de salud; marcas A VERIFICAR por etapa |
| Autocomplete bloqueado | Best effort, desactivable, caché |
| Límite gratuito de Gemini insuficiente | Presupuesto diario con pausa y reanudación; caché; repeticiones configurables; Ollama en servidor propio |
| Respuestas vía API no coinciden con las apps | Honestidad en la interfaz; extensión de navegador para respuestas reales; modo manual |
| Excel crece demasiado | Particionado mensual y por país; resúmenes; archivado; ExcelJS en streaming |
| Conflictos de escritura en modo git | Control optimista por sha, bloqueos en jobs.xlsx, un commit por lote, reintentos |
| Límite de 5.000 solicitudes/hora de la API de GitHub | Lotes grandes, un commit por ejecución, caché de lectura por sha |
| Créditos de Netlify agotados | Frecuencias diaria/semanal, tope de encadenamientos, contador con aviso al 80%, migración a servidor propio sin cambios |
| Captura automatizada bloqueada o contraria a términos | Desactivada por defecto, solo servidor propio, límites estrictos, aviso permanente; la extensión es la vía recomendada |
| Dependencias AGPL | license-checker en CI; lista de licencias permitidas en CONTRIBUTING |
| Mantenimiento concentrado en pocas personas | Arquitectura modular, tests, documentación, apertura del repositorio cuando se decida |

---

## 19. Lo que SEOBESTIA deliberadamente no hace (y lo dice en la interfaz)

- No usa ninguna API de pago ni ofrece conectores de pago.
- No automatiza las interfaces de ChatGPT, Perplexity o Gemini desde el servidor; la extensión captura lo que la persona ve.
- No fabrica volúmenes, backlinks ni tráfico de terceros; cuando no hay dato oficial, lo dice.
- No publica cambios en sitios (D1).
- No promete "prompt volume" (no es medible gratis desde fuera).
- No vende llms.txt como palanca de visibilidad; lo ofrece como utilidad.
- No envía correos ni mensajes externos (D7).

---

## 20. Fuentes consultadas (noviembre de 2026)

**Referencias de producto**
- canivibecodeit.com — categorías SEO & Marketing y Analytics; CONTRIBUTING.md y `data/apps/*.json` en github.com/canivibecodeit/canivibecodeit (MIT).
- SerpBear — github.com/towfiqi/serpbear · docs.serpbear.com/miscellaneous/integrate-google-search-console · docs.serpbear.com/miscellaneous/integrate-google-ads.
- OpenSEO — openseo.so · github.com/every-app/open-seo · openseo.so/blogs/best-open-source-seo-tools.
- elmo — github.com/elmohq/elmo · geo-aeo-tracker — github.com/danishashko/geo-aeo-tracker · awesome-ai-search-visibility — github.com/sasateguh/awesome-ai-search-visibility · Crawlee — github.com/apify/crawlee · SEOnaut — github.com/stjudewashere/seonaut · SiteOne Crawler — github.com/janreges/siteone-crawler · geoptimize, geo-lint, llms-txt (AnswerDotAI) · ExcelJS — github.com/exceljs/exceljs · schema-dts — github.com/google/schema-dts.

**APIs oficiales**
- Search Console: developers.google.com/webmaster-tools/v1/searchanalytics/query · developers.google.com/webmaster-tools/limits · developers.google.com/webmaster-tools/v1/urlInspection.index/inspect · developers.google.com/webmaster-tools/v1/sitemaps · support.google.com/webmasters/answer/96568.
- Google Ads API: developers.google.com/google-ads/api/docs/get-started/dev-token (retiro de developer tokens, 9-sep-2026) · developers.google.com/google-ads/api/docs/access-levels · developers.google.com/google-ads/api/docs/best-practices/quotas · developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas · developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics · ads-developers.googleblog.com/2025/10/explorer-access-is-now-available-for.html · groups.google.com/g/adwords-api/c/Ezw0AH6XJeI.
- PageSpeed Insights: developers.google.com/speed/docs/insights/v5/get-started · CrUX: developer.chrome.com/docs/crux/api · developer.chrome.com/docs/crux/history-api.
- GA4 Data API: developers.google.com/analytics/devguides/reporting/data/v1/quotas.
- Bing Webmaster Tools: learn.microsoft.com/en-us/bingwebmaster/getting-access · IndexNow: indexnow.org/documentation.
- Google Trends API (alfa): developers.google.com/search/blog/2025/07/trends-api · developers.google.com/search/apis/trends.
- Gemini: ai.google.dev/gemini-api/docs/pricing (límites gratuitos a confirmar en AI Studio) · OpenAI: developers.openai.com/api/docs/guides/rate-limits · Anthropic: platform.claude.com/docs/en/api/rate-limits · Perplexity: docs.perplexity.ai/getting-started/pricing.
- Custom Search JSON API (cierre 1-ene-2027): developers.google.com/custom-search/v1/overview.
- GitHub REST API (Contents, Git Data, límites): docs.github.com/en/rest.

**GEO / AEO**
- Paper GEO: arxiv.org/abs/2311.09735 · Google "Succeeding in AI search": developers.google.com/search/blog/2025/05/succeeding-in-ai-search.
- Ahrefs: ahrefs.com/blog/search-rankings-ai-citations · ahrefs.com/blog/ai-overview-brand-correlation · ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content · ahrefs.com/blog/llmstxt-study · ahrefs.com/blog/ai-overviews-reduce-clicks-update.
- Semrush: semrush.com/blog/most-cited-domains-ai · semrush.com/blog/reddit-ai-search-visibility-study · semrush.com/blog/the-ghost-citations-study.
- SE Ranking (vía Search Engine Journal): searchenginejournal.com/new-data-top-factors-influencing-chatgpt-citations/561954 · searchenginejournal.com/google-ai-overview-citations-from-top-ranking-pages-drop-sharply/568637.
- seo.com/blog/ai-mode-citations · docs.peec.ai/research/content-types-cited-most-by-engine · digitalapplied.com/blog/ai-search-citation-ranking-factors-2026-data-study.
- Crawlers de IA: aicrawlercheck.com/blog/ai-crawler-robots-txt-study-2026 · ipbot.com/crawlers/openai/chatgpt-user-vs-gptbot-vs-oai-searchbot.
- Intención: arxiv.org/html/2504.21398v2 · mlforseo.com (search intent classification).

**Despliegue**
- Netlify: docs.netlify.com/build/functions/configuration · docs.netlify.com/build/functions/background-functions · docs.netlify.com/build/functions/scheduled-functions · netlify.com/pricing · docs.netlify.com (skip builds con [skip netlify]).

---

*Fin del documento. Versión 2.0 — 3 de noviembre de 2026.*
