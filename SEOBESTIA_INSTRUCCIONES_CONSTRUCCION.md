# SEOBESTIA — Especificación vigente del producto

**Versión:** 3.1  
**Fecha:** 3 de noviembre de 2026  
**Estado al 4 de noviembre de 2026.** El punto 4 cuenta con una implementación local del recorrido del piloto. La aceptación alojada y la medición con una web real siguen pendientes. [Abrir la guía de uso y despliegue](README.md).

La selección técnica del punto 2 está en [Viabilidad y arquitectura gratuita](docs/VIABILIDAD_Y_ARQUITECTURA_GRATUITA.md) y [Registro de decisiones](docs/DECISIONES.md). Esos documentos concretan las selecciones que aquí figuran por verificar; no convierten sus pruebas futuras en pruebas realizadas.

## 1. Autoridad y propósito

Esta versión reemplaza íntegramente la versión 2.0 y sus prompts de construcción. El original se conserva en `docs/archivo/SEOBESTIA_INSTRUCCIONES_V2_HISTORICO.md` como referencia histórica, sin autoridad sobre decisiones incompatibles con esta versión.

SEOBESTIA permitirá que un equipo agregue las webs con las que trabaja, evalúe su situación, encuentre keywords útiles —incluidas long-tail—, prepare mejoras técnicas y contenido, y revise diariamente su evolución.

Recorrido principal: **sitio → diagnóstico → oportunidad de keyword → página objetivo → mejora o contenido → publicación externa por el equipo → seguimiento diario → siguiente acción.**

Los puntos 1 y 2 establecieron los requisitos y su viabilidad. El punto 3 definió la propuesta del piloto. El punto 4 incorpora aplicación, conectores y pruebas. El punto 5 valida SEOBESTIA como sistema multisitio con el equipo. Se comprueba que el recorrido se puede repetir en distintas webs autorizadas y que cada una conserva sus datos y permisos. [Criterios del punto 5](docs/PROPUESTA_PILOTO.md#punto-5-del-proyecto--validar-seobestia-con-el-equipo).

Las cuotas, licencias, capacidades y precios de la versión anterior no se consideran verificados. Las fuentes consultadas y sus límites están registrados en el informe de viabilidad; las decisiones técnicas se mantienen en `docs/DECISIONES.md`.

## 2. Prioridades y restricciones

1. Investigación de keywords y long-tail relevantes para el negocio.
2. Diagnóstico técnico con evidencia y correcciones concretas.
3. Briefs, mejora de páginas y contenido útil fundamentado.
4. Seguimiento diario y evaluación de resultados.
5. Visibilidad en IA y herramientas complementarias, subordinadas al núcleo.

La programación diaria se construye desde los cimientos, aunque sus análisis se amplíen gradualmente.

| Área | Decisión vigente |
|---|---|
| Costo | Uso gratuito para todo el equipo. Sin suscripciones, APIs pagadas, funciones premium ni pruebas que después obliguen a pagar. |
| IA | Analizador estadístico incluido y activo para todos los sitios. Para generar ideas editoriales cada persona conecta su propia clave de OpenAI, Claude o Gemini y decide cuándo usarla. |
| Datos | Toda métrica indica fuente, fecha, alcance y condición de medida, estimada, sugerida o capturada. |
| Almacenamiento | PostgreSQL en Neon Free para el piloto, con cuotas y respaldos definidos en el informe. Excel solo para exportación. |
| Alojamiento | Netlify Free seleccionado para piloto acotado tras comparar alternativas. No es una obligación permanente ni una garantía de capacidad ilimitada. |
| Acceso | Privado para el equipo, con identidades individuales para asignaciones e historial; mecanismo gratuito por verificar. |
| Interfaz | Español neutro, accesible y comprensible sin conocimientos técnicos de SEO. |
| Notificaciones | Dentro del sistema: Hoy, campana e historial. Sin correo ni mensajería externa. |
| Cambios en webs | El sistema recomienda y prepara. El equipo publica, modifica, redirige o elimina externamente. |
| Licencia | Proyecto seobestia con licencia propia MIT; reutilización con licencias compatibles verificadas y atribución. |

La gratuidad del software no implica infraestructura o datos gratuitos. Un equipo propio exige recursos y conexión; no se presentará como nube gratuita permanente. Si una capacidad no es viable gratis, mostrar el límite y ofrecer modo manual o reducido. Nunca introducir un servicio pagado silenciosamente.

No prometer primeras posiciones, citas ni resultados en un plazo fijo. La calidad se demuestra con exactitud, trazabilidad, utilidad y funcionamiento fiable.

## 3. Equipo y alta de sitios

Permisos iniciales: administrador y miembro. El administrador configura conexiones, accesos y límites; los miembros analizan, preparan contenido y gestionan tareas. Sin registro público ni gestión comercial de clientes. Registrar autor, fecha y versión de cambios relevantes.

Datos del sitio: dominio o URL base, nombre, país e idioma, actividad, productos o servicios prioritarios. Opcionales: otros países, marca y alias, competidores, objetivos de conversión y perfil editorial.

Plantillas: legal, comercio electrónico, SaaS, negocio local y genérica. Ayudan a interpretar intención, sin imponer puntuaciones universales.

Confirmar autorización antes de rastrear. Las conexiones privadas requieren permisos de la fuente. Sin conexión, ofrecer diagnóstico público e importaciones indicando qué falta. El equipo comparte las conexiones de medición de cada sitio. Las claves editoriales son personales y se configuran por sesión.

## 4. Diagnóstico y score

Mostrar resumen general y tres dimensiones: salud técnica, calidad y cobertura de contenido, preparación para responder preguntas y servir como fuente.

Separar los resultados observados: clics, impresiones, posiciones, conversiones disponibles y citas detectadas. Preparación para ser citado no equivale a presencia real en respuestas.

El score utiliza reglas versionadas y reproducibles. La IA puede explicar hallazgos, pero no asignar arbitrariamente una nota técnica. Mostrar controles aprobados, fallidos, no aplicables y no evaluados, cobertura y fecha.

No tratar datos faltantes como cero ni como aprobados. Marcar el score como parcial o no mostrarlo cuando no sea interpretable. Destacar bloqueos críticos aunque otras comprobaciones eleven la nota.

Cada penalización enlaza URLs, evidencia, consecuencia probable, solución y condición de resolución. Los pesos y mínimos de cobertura se definirán con el catálogo de reglas y pruebas antes de implementar. No heredar pesos de la versión 2.0. Comparar notas calculadas con la misma metodología o explicar el cambio.

## 5. Keywords y long-tail

### 5.1 Fuentes y procedencia

Combinar consultas propias, páginas del sitio, fuentes gratuitas verificadas, importaciones, capturas y propuestas por reglas o IA opcional.

Por observación: término original y normalizado, país, idioma, dispositivo cuando corresponda, fuente, fecha de captura, período del dato y tipo de evidencia. Conservar unidades y rangos.

Distinguir keyword observada, sugerencia sin validar, demanda estimada o rango informado y ausencia de dato. Sin volumen no significa cero búsquedas. Impresiones propias no equivalen al volumen total del mercado; competencia publicitaria no equivale a dificultad SEO; posición media no es una posición exacta observada.

### 5.2 Descubrimiento

Entradas: URL, servicio, producto, keyword semilla, consultas existentes o lista importada. Descubrir preguntas, comparaciones, problemas, ubicaciones, variantes y etapas de decisión.

Reconocer long-tail por especificidad de necesidad, no solo por cantidad de palabras. Explorar modificadores relevantes de precio, requisitos, proceso, plazo, localidad o caso de uso. Evitar listas masivas de combinaciones irrelevantes.

Las preguntas hipotéticas son sugerencias. Solo llamarlas preguntas observadas de Google cuando una fuente o captura lo acredite.

### 5.3 Evaluación

Cada oportunidad debe explicar relevancia para el negocio, intención, tipo de página apropiado, evidencia de demanda, página existente o faltante, motivo para priorizar, esfuerzo y confianza.

Priorizar combinando relevancia comercial, evidencia de interés, rendimiento propio, cobertura actual, esfuerzo y confianza. Documentar y probar la fórmula antes de mostrar una puntuación. No inventar dificultad de mercado sin datos.

Una búsqueda de menor demanda y alto valor comercial puede ser prioritaria. Los valores desconocidos permanecen desconocidos, sin rellenarlos artificialmente.

### 5.4 Agrupación y páginas

Agrupar por necesidad e intención compartidas, con revisión humana. Variantes cercanas pueden resolverse en una página; intenciones distintas pueden necesitar páginas diferentes aunque compartan vocabulario.

Cada grupo tendrá keyword principal, variantes, preguntas, intención, página objetivo y acción: mantener, mejorar, crear, investigar o consolidar. No producir un artículo por keyword automáticamente.

Dos URLs con impresiones para una consulta no demuestran canibalización. Revisar intención, alternancia, rendimiento y función antes de recomendar consolidación.

### 5.5 Interfaz

Explorador filtrable, grupos y lista de oportunidades con evidencia. Enviar directamente a tarea o brief. Exportar conservando fuentes, fechas, países y desconocidos. Permitir descartar términos con motivo persistente.

## 6. Contenido y mejoras editoriales

El brief incluye objetivo comercial, audiencia, intención, keyword principal, long-tail, página objetivo, preguntas, estructura, información necesaria, fuentes por comprobar, enlaces internos y llamada a la acción.

Identificar referencias mediante URL y fecha. Explicar qué aportará la página: experiencia, proceso, comparación fundamentada, información original o respuesta específica. No imponer densidad de keywords ni longitud universal.

El núcleo permite crear y editar briefs y textos sin IA. Una opción gratuita validada podrá asistir, pero su caída o agotamiento no bloqueará el editor.

Estados: brief, borrador, en revisión, aprobado, publicado externamente y archivado. Publicado requiere URL y fecha confirmadas por el equipo o evidencia verificada. Conservar versiones y comparación de cambios.

Antes de reescribir una página, mostrar consultas y secciones que aportan resultados. Evaluar intención, preguntas respondidas, claridad, coherencia, fuentes, enlaces, metadatos y sobreoptimización. Cada sugerencia explica qué falta y dónde.

No inventar estadísticas, testimonios, expertos, citas ni experiencia profesional. Diferenciar fuentes sugeridas de verificadas. Señalar textos sensibles que requieren revisión experta, especialmente en la vertical legal.

No usar bloques de 120–180 palabras, cantidades fijas de estadísticas, fechas artificialmente recientes o llms.txt como garantías de visibilidad en IA.

## 7. Auditoría técnica

Rastreo autorizado, respetando robots.txt, velocidad, alcance y límite de URLs. Controlar redirecciones, duplicados, parámetros y trampas. Registrar si se analizó HTML recibido o contenido renderizado. Mostrar controles pendientes cuando no sea posible renderizar.

Catálogo inicial: estados HTTP, enlaces rotos, cadenas de redirección, indexabilidad, robots, canónicas, sitemap, títulos, descripciones, encabezados, duplicados relevantes, enlaces internos, profundidad, posibles huérfanas, imágenes y alt, idioma, hreflang y datos estructurados coherentes con lo visible.

Añadir rendimiento distinguiendo laboratorio y datos reales de usuarios; acceso de rastreadores explicado por agente; comparación con revisiones anteriores. Construir reglas confiables con pruebas, sin una cantidad comercial obligatoria.

Cada problema incluye regla y versión, severidad, URLs, evidencia fechada, explicación, pasos de corrección, responsable, estado y comprobación de resolución. Mostrar cobertura del rastreo para no afirmar ausencias que no se han comprobado.

Preparar propuestas de títulos, descripciones, enlaces o marcado cuando proceda. El equipo aplica los cambios; SEOBESTIA los verifica después.

## 8. Revisiones diarias y decisiones

### 8.1 Rutina

Cada sitio activo tiene revisión diaria programada, con zona horaria visible y configurable; valor inicial America/Santiago. La hora se ajustará al entorno comprobado.

Cada ejecución sincroniza datos nuevos y revisados, descubre URLs desde sitemap/enlaces/importaciones/declaraciones, revisa páginas prioritarias, recalcula oportunidades con evidencia nueva y actualiza Hoy. Registra cobertura, fallos, datos hasta, última ejecución correcta y próximo intento.

La revisión lógica es diaria. El rastreo completo y mediciones costosas pueden ser semanales según presupuesto; mostrar su fecha real. No garantizar descubrir una URL en 24 horas si ninguna fuente la expone. Permitir registrar publicaciones manualmente.

### 8.2 Madurez

Hipótesis iniciales configurables para el piloto:

| Momento | Evaluación |
|---|---|
| Publicación o cambio detectado | Accesibilidad, enlaces, contenido e instrucciones de indexación. |
| Revisión diaria | Nuevas señales, incidencias y tareas. |
| Alrededor de 7 días | Comprobación temprana sin conclusiones prematuras de rendimiento. |
| Alrededor de 28 días | Primera evaluación de rendimiento con muestra suficiente. |
| Alrededor de 90 días | Evaluación más amplia de mantener, mejorar o consolidar. |

No son plazos prometidos de indexación o posicionamiento. Considerar retrasos, estacionalidad, demanda, historial, cambios y función de la página. Una fecha por sí sola nunca dispara retirada.

### 8.3 Acciones

| Acción | Justificación posible |
|---|---|
| Mantener | Cumple su función sin problemas relevantes. |
| Esperar o investigar | Publicación reciente, muestra pequeña o datos incompletos. |
| Corregir técnicamente | Fallo comprobable de acceso, indexación o experiencia. |
| Mejorar | Intención incompleta, información desactualizada u oportunidad respaldada. |
| Consolidar | Redundancia e intención compartida con justificación editorial. |
| Proponer redirección | Sustitución pertinente con revisión de destino y enlaces. |
| Proponer retirada | Contenido sin función útil, obsoleto o perjudicial tras revisión humana. |

Antes de proponer retirada, revisar antigüedad, indexación, función comercial, conversiones disponibles, enlaces conocidos, estacionalidad y sustitutos. Declarar faltantes. Cero clics no significa falta de utilidad.

No automatizar publicación, cambios, noindex, redirecciones ni borrado externos. Distinguir recomendación, acción aplicada por el equipo y resultado observado.

### 8.4 Alertas

Alertar por cambios significativos, no en cada ejecución. Deduplicar por sitio, entidad y problema; permitir reconocer, asignar y silenciar. Reaperturas con evidencia nueva.

Comparar períodos completos equivalentes considerando ruido, muestra y estacionalidad. Calibrar umbrales con pruebas y piloto, sin heredar porcentajes universales. Una falla de API no es tráfico cero; revisión atrasada o fuente ausente genera incidencia operativa, no una conclusión SEO falsa.

## 9. Tareas y resultados

Campos: tipo, prioridad explicada, sitio, URL o grupo de keywords, evidencia, recomendación, esfuerzo, responsable, estado, fechas y resultado esperado.

Estados: pendiente, en curso, aplicada externamente, en seguimiento, cerrada y descartada. Aplicada no significa mejora demostrada. Registrar fecha efectiva y cambios para comparar períodos.

Resolución técnica mediante su regla; resultados de rendimiento con contexto. No atribuir causalidad cuando existen varias intervenciones o factores externos. Sin datos de conversiones, no concluir sobre ventas.

No forzar estimaciones de clics para todo problema. Las estimaciones defendibles incluyen supuestos, rango y confianza.

## 10. Experiencia del equipo

Inicio global: sitios, salud, revisiones atrasadas y tareas importantes. Hoy por sitio: qué cambió, qué hacer, oportunidades de keywords y resultados observados.

Navegación: Hoy, Keywords, Auditoría, Contenido, Tareas, Resultados y Configuración. Visibilidad en IA cuando su medición esté validada. Administración de accesos, conexiones, trabajos, límites, exportaciones y respaldos.

Todas las vistas contemplan carga, vacío, información parcial, error recuperable y éxito. Los vacíos explican qué conectar o importar. Acceso por teclado, contraste y foco visible. Cada métrica muestra definición, fuente, fecha y evidencia.

## 11. Fuentes a investigar

Requisitos de fuentes. La investigación documental está resuelta en el informe de viabilidad; el acceso concreto y la cuota efectiva deben probarse durante implementación, sin activar servicios pagados:

| Candidato | Uso previsto | Verificación requerida |
|---|---|---|
| Search Console | Consultas propias, páginas y rendimiento | Permisos, dimensiones válidas, límites de extracción, omisiones, retrasos y preliminares. |
| Keyword Planner | Ideas y demanda | Acceso real sin gasto obligatorio, requisitos, rangos y restricciones. Si exige pago, no es dependencia del núcleo. |
| Bing Webmaster Tools | Datos del sitio | Endpoints gratuitos y diferencia entre funciones del panel y API. |
| PageSpeed Insights y CrUX | Rendimiento | Cuotas y cobertura; separar campo y laboratorio. |
| GA4 opcional | Sesiones y conversiones | Permisos y configuración real, sin exigirlo para el núcleo. |
| Páginas y sitemap | Rastreo y referencias | Autorización, robots, límites y cobertura. |
| Importaciones y capturas | Evidencia complementaria | Formatos, procedencia, validación y deduplicación. |
| Sugerencias de búsqueda | Ideas | Oficialidad, condiciones y estabilidad; no dependencia obligatoria. |
| IA gratuita o local | Asistencia | Licencia, cuotas, privacidad, recursos y ausencia de facturación. |

Investigar resultados de búsqueda y preguntas relacionadas sin asumir una fuente gratuita completa. Una idea generada no sustituye evidencia de demanda. Utilizar fuentes propias e importación cuando falten datos externos.

## 12. IA y visibilidad en respuestas

El analista del sitio trabaja por defecto en el servidor con reglas y un modelo estadístico ajustado al historial. Para crear propuestas editoriales generativas se utiliza exclusivamente el proveedor que la persona configuró en Mi IA. La interfaz identifica quién recibe los temas y que cada solicitud puede consumir cuota o saldo. La revisión diaria nunca utiliza las claves personales.

Enviar datos mínimos, explicar su tratamiento y proteger información de clientes. No enviar secretos. Registrar modelo, instrucciones y evidencia necesaria para interpretar resultados.

Para citas: separar mención y enlace, conservar prompt, motor, fecha, contexto conocido, respuesta, fuentes y método. No equiparar respuestas API con aplicaciones de consumo. Las métricas representan la muestra observada, no todas las respuestas del motor.

Captura manual primero; extensión posterior si demuestra valor y se verifican condiciones y mantenimiento. No afirmar que capturar una página garantiza cumplir términos de cualquier servicio. No inventar volumen de prompts ni acceso a informes no expuestos por APIs.

## 13. Arquitectura y datos

Separar aplicación, acceso, datos, conectores, auditoría, keywords, contenido, tareas, trabajos y exportación. Dirección técnica: TypeScript y componentes mantenibles; framework confirmado según alojamiento.

Persistencia transaccional con índices, migraciones y respaldos. PostgreSQL en Neon Free es la selección del piloto; Node y PostgreSQL en servidor propio son la alternativa de crecimiento. Entorno, cuotas efectivas y recuperación se comprobarán durante la primera entrega.

Entidades mínimas: usuarios, sitios, membresías, conexiones, URLs, rastreos, hallazgos, observaciones, keywords, evidencias, grupos, asignaciones de páginas, briefs, versiones, tareas, intervenciones, evaluaciones, alertas y ejecuciones.

Conservar procedencia y versiones externas. Una revisión actualiza la vista vigente sin sumar ambas versiones. La deduplicación incluye sitio, fuente, tipo, período y dimensiones aplicables. No mezclar países, dispositivos o tipos de búsqueda.

No persistir mediante commits por escritura ni usar Excel como base. Separar código, datos y secretos. Exportar CSV y Excel sin credenciales.

Cola persistente con estado, cursor, intentos, próxima ejecución y exclusión temporal con vencimiento. Trabajos idempotentes, reanudables y presupuestados. Programación sin abrir la web; si exige equipo propio encendido, explicitarlo y detectar revisiones perdidas.

Servir vistas resumidas; rastreos y análisis largos fuera de peticiones interactivas. Ajustar lotes al entorno comprobado.

Seguridad: autorización por equipo y sitio, secretos en servidor, conexiones cifradas, validación, límites y registro. Impedir que URLs o redirecciones del crawler accedan a redes privadas, servicios internos o destinos no autorizados.

Respaldos automáticos y restauración probada. Fijar frecuencia y retención según capacidad real. Una copia nunca restaurada no satisface el requisito de recuperación.

## 14. Reutilización open source

Referencias: [SerpBear](https://github.com/towfiqi/serpbear), [OpenSEO](https://openseo.so/) y [Can I Vibe Code It](https://canivibecodeit.com/category/seo-marketing). Evaluar seguimiento, historial, investigación, flujos y prompts adaptables.

Candidatos técnicos de la versión anterior: Crawlee, Playwright, Cheerio, Readability, validación de datos estructurados y componentes de interfaz.

Antes de integrar: registrar versión, licencia, atribuciones, mantenimiento, dependencias y piezas reutilizadas. Código público no equivale a licencia compatible ni a datos gratuitos. No ejecutar prompts que introduzcan APIs pagadas o una arquitectura incompatible. Reutilizar módulos concretos en una experiencia coherente.

## 15. Entregas verificables

Sin estimaciones de tiempo. Cada entrega valida su recorrido y documenta límites.

| Entrega | Alcance y aceptación |
|---|---|
| Previa: investigación | Validar fuentes, referencias, almacenamiento, alojamiento y ejecución diaria. Matriz de capacidades confirmadas, manuales y no disponibles con fuentes y fecha; después plan de implementación. |
| 1: base operativa | Accesos, sitios, datos, cola diaria e historial. Probar ejecución sin interfaz abierta, recuperación, ausencia de duplicados y restauración. Ejecución manual no certifica programación. |
| 2: diagnóstico | Datos propios o importación, rastreo y oportunidades existentes. Cada hallazgo enlaza URL y evidencia; faltantes visibles. |
| 3: keywords | Descubrimiento, long-tail, evaluación, grupos y páginas. Comparar oportunidades reales con revisión humana; no inventar volumen. |
| 4: contenido | Briefs, editor, versiones y tareas. Oportunidad convertida en intervención trazable; recorrido funcional sin IA. |
| 5: seguimiento | Alertas, madurez y resultados. Fallos detectados en la siguiente revisión exitosa que los comprueba; no retirar por falta de datos ni simular caídas ante error de API. |
| 6: complementos y piloto | Citas, extensión, reportes o agentes después del núcleo. Piloto real de al menos un ciclo de 28 días; continuar si falta evidencia. No es certificación de ranking. |

## 16. Calidad y pruebas

Pruebas obligatorias: procedencia y separación de territorios; rangos y desconocidos conservados; long-tail pertinentes frente a ejemplos irrelevantes; agrupación reproducible y editable; score explicable; auditoría con problemas conocidos y páginas correctas para detectar falsos positivos.

También: versiones editoriales recuperables, ausencia de publicación automática, escrituras concurrentes, revisiones sin doble conteo, restauración, reanudación, programación efectiva y agotamiento de cuotas sin conversión a pago.

Probar alertas con ruido, muestras pequeñas y retrasos; accesos autorizados; secretos fuera del cliente; destinos de rastreo restringidos; recorrido completo y accesible.

Medir rendimiento con datos representativos del piloto y fijar objetivos antes de ampliar capacidad. No prometer millones de filas o miles de páginas en infraestructura gratuita sin una prueba real.

## 17. Exclusiones iniciales

- Publicar, modificar, redirigir o borrar automáticamente webs.
- APIs pagadas, suscripciones, facturación y claves personales pagadas.
- Índices propios de backlinks o tráfico de todo internet.
- Garantías de primera página o citas.
- Automatizar interfaces de buscadores o chats como dependencia central.
- Extensión, API pública amplia, MCP o PDF avanzado antes del núcleo.
- Informes de IA asumidos disponibles sin verificar.
- Reglas basadas únicamente en densidad, longitud o juicio de un modelo.

## 18. Cambios y próximo paso

Cambios respecto de v2: Excel deja de ser almacenamiento; Netlify deja de ser obligatorio; identidades del equipo reemplazan contraseña única; IA es opcional; revisión diaria comienza en los cimientos; scoring se calibra; fuentes se verifican; keywords, técnica y contenido tienen prioridad sobre complementos. Los prompts antiguos quedan invalidados para implementación directa.

La propuesta del punto 3 y el piloto local del punto 4 están disponibles en la carpeta del proyecto. La aceptación operativa requiere conectar el alojamiento y una propiedad autorizada, observar dos ciclos diarios y recuperar una copia del almacenamiento remoto. La evaluación posterior del contenido requiere datos de una intervención real. [Guía del piloto](README.md) · [Pruebas de persistencia](docs/VALIDACION_ALMACEN.md).
