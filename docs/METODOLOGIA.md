# Cómo pasar de un hallazgo a una decisión

Catálogo técnico `tecnica-html-3` y metodología revisados el 6 de noviembre de 2026. Cada cambio de reglas debe llevar versión y pruebas para que dos notas de auditoría sigan siendo comparables.

En la demostración, las páginas, las búsquedas y las métricas son ficticias. Para probar el mismo recorrido en una web real, registra el sitio autorizado, describe qué ofrece y conecta o importa sus datos siguiendo la [guía de arranque](../README.md).

## Cómo leer la visibilidad en IA

Las respuestas de IA cambian entre repeticiones, así que una sola prueba no mide nada. Cada indicador es una frecuencia sobre muchas respuestas, con su rango de Wilson al 95 %. La posición en la lista se descarta por inestable. Cada fila separa motor y tipo de pregunta, y no existe una nota global que los mezcle.

- **Mención, cita y recomendación** son señales distintas. En una pregunta sobre la marca, la mención no cuenta, porque la propia pregunta la nombra. Allí solo vale la cita. Un rechazo o una respuesta incompleta quedan fuera del denominador.
- **La detección** busca el nombre exacto o el dominio. Si hay coincidencia, un modelo clasificador decide si se refiere a esta empresa y si la recomienda, solo la nombra o advierte. Sin coincidencia no se le consulta. Si no responde, la mención se conserva y la recomendación queda sin clasificar. Antes de confiar en el clasificador, compara unas 100 respuestas con una revisión manual.
- **El panel automático** hace una pasada periódica a OpenAI por API con búsqueda, semanal por defecto. Mide esa API: no equivale a lo que ve una persona en ChatGPT. Si el modelo se retira, su reemplazo inicia otra serie.
- **La calibración** son respuestas tomadas de las aplicaciones reales, importadas con `npm.cmd run importar-geo`. Es una serie aparte: sirve para contrastar la tendencia del panel y nunca se suma a él.
- **Las visitas desde IA** provienen de Analytics 4 y son la única señal de tráfico real. Son un mínimo, porque muchas respuestas no generan un clic ni un origen identificable.

Un cambio solo se declara demostrado con al menos 20 respuestas en 5 fechas distintas por ventana de 28 días, para la misma pregunta y el mismo motor, cuando los dos rangos no se cruzan. Con una pasada semanal no se alcanza por pregunta: acorta `SEO_AI_PANEL_DAYS` a un día para evaluar un cambio concreto, o lee la tendencia sabiendo que su rango es amplio. Cambiar de modelo inicia otra serie. Si las preguntas de control también cambiaron, el resultado queda en revisión, porque el motor pudo cambiar y no el contenido. Con esas muestras solo se detectan saltos grandes por pregunta: un salto de 5 % a 15 % requiere unas 140 respuestas por período.

## 1. Auditar una página

Si un enlace de una categoría lleva a una página con error, abre el hallazgo y revisa en la ficha qué URL devolvió el error y desde dónde se enlaza. Así puedes corregir el enlace de origen o recuperar la página de destino. El inspector muestra la respuesta HTTP, los saltos de redirección conocidos, la profundidad desde la entrada y los enlaces entrantes y salientes observados. Una URL encontrada solo en el sitemap puede carecer de una profundidad de enlace conocida.

Para páginas HTML, la ficha incluye título, descripción, encabezados, canónica, directivas de robots del documento y de la respuesta, alternativas de idioma, imágenes y datos JSON-LD. Una página «elegible» respondió correctamente sin exclusión ni canónica alternativa detectadas. Google decide si la incorpora a su índice. La comprobación de JSON-LD detecta problemas de sintaxis y enumera los tipos encontrados. Los requisitos particulares de cada resultado enriquecido requieren una validación adicional. [Informe de inspección de URLs de Google](https://support.google.com/webmasters/answer/9012289) · [Herramienta de resultados enriquecidos](https://search.google.com/test/rich-results).

La nota pondera los controles aprobados sobre todos los evaluables. Cada regla muestra su peso y sus comprobaciones aprobadas, fallidas u omitidas. Las cinco dimensiones cubren acceso e indexabilidad, contenido y metadatos, enlazado y redirecciones, idioma y alternativas, e imágenes y datos estructurados. El equipo debe confirmar si una directiva `noindex` es intencional. La exclusión por sí sola no reduce la nota. Los duplicados de texto requieren una coincidencia exacta de la huella del texto normalizado y al menos 30 palabras por página. La regla de página casi sin texto se activa con menos de 30 palabras en el HTML recibido y es la de mayor peso en contenido, porque suele indicar que el texto depende de JavaScript. La de poco texto, entre 30 y 99 palabras, es una señal leve que el equipo debe valorar, ya que una página de contacto puede ser breve con razón. También se revisan los títulos de más de 70 caracteres, las páginas con varios H1 y la etiqueta viewport.

La velocidad de PageSpeed Insights se muestra aparte y no suma a la nota técnica. Si el servidor tiene `PAGESPEED_API_KEY`, cada revisión mide la página de inicio en móvil y escritorio. La prueba de laboratorio varía entre ejecuciones. Los datos de personas reales requieren tráfico suficiente en Chrome y pueden describir todo el origen en lugar de la página.

El rastreo acepta que una web autorizada responda en la variante `www` o HTTPS de su propio dominio y actualiza la ficha. Una redirección a otro dominio queda fuera de alcance y se informa. Si `robots.txt` responde con un error 4xx distinto de 429, el rastreo continúa sin sus reglas, según RFC 9309, y lo avisa cuando el código sugiere un bloqueo. Un 429 o un 5xx detienen la revisión.

El rastreo lee el HTML que devuelve el servidor, dentro del ámbito autorizado, y respeta las exclusiones de robots. Puede programar hasta 500 direcciones por barrido y leer hasta 1 MB por respuesta. Por página conserva hasta 160 enlaces salientes, 40 encabezados, 40 alternativas de idioma y 24 ejemplos de imágenes. Cuenta todas las imágenes del HTML leído y comprueba hasta 20 bloques JSON-LD. Registra enlaces externos tal como aparecen sin visitar sus destinos. El contenido generado al ejecutar JavaScript en un navegador queda fuera de este inventario.

Los hallazgos nuevos y resueltos se calculan entre los dos últimos barridos completos con el mismo conjunto de URLs, ámbito y versión de reglas. El historial guarda identificadores y un resumen por hallazgo, hasta 1.500 hallazgos o 256 KiB por lista. Si el límite recorta la evidencia, o se alcanzan límites de extracción que afectan a la comparación, el inspector explica por qué no puede determinar el cambio.

## 2. Elegir una keyword y preparar el encargo

Busca una consulta con impresiones en la página adecuada. Comprueba país, dispositivo, período y procedencia. Una palabra que aparece en un encabezado acredita presencia en el texto. Una fila de Search Console acredita apariciones de la web para esa consulta. Las sugerencias de investigación conservan su hipótesis hasta que el equipo obtenga evidencia. La impresión de una web concreta no mide el volumen de búsquedas del mercado. [Datos del informe de rendimiento de Search Console](https://support.google.com/webmasters/answer/7576553).

El taller admite un pedido de 1 a 20 encargos. Trabaja con observaciones fechadas y finales, una página asociada, impresiones positivas y clics válidos. Toma los últimos 28 días disponibles dentro de los 35 días recientes. Comprueba la relación de la búsqueda con el negocio o la presencia de eventos clave recientes en la página de entrada. Propone una ampliación por URL y puede sugerir artículos complementarios para necesidades informativas distintas. Las variantes long-tail del encargo incluyen su evidencia.

El equipo decide si completar una página existente o preparar un artículo para una necesidad distinta. El encargo sugiere estructura, pruebas que aportar y una acción útil para el lector. Solo calcula un escenario de clics cuando encuentra suficientes consultas comparables del propio sitio. Contrasta los datos, añade experiencia propia y revisa si otra página ya responde a esa necesidad antes de publicar. [Fundamentos de la Búsqueda](https://developers.google.com/search/docs/essentials) · [Contenido útil y fiable](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) · [Funciones de IA en la Búsqueda](https://developers.google.com/search/docs/appearance/ai-features).

## 3. Publicar y decidir cuándo intervenir

Registra la URL, la fecha y el objetivo de la intervención. El planificador reserva una revisión diaria por sitio según la fecha de Santiago y distribuye el barrido amplio en lotes semanales. En local, el servidor debe estar encendido. La revisión del día puede encontrar errores técnicos de inmediato. Para valorar rendimiento, compara períodos que ya tienen datos.

| Objetivo | Evidencia para decidir |
| --- | --- |
| Google | Para una página existente, compara los 28 días anteriores y los 28 posteriores, excluyendo el día del cambio. Cada ventana requiere 28 días observados y al menos 50 impresiones. Para un nuevo artículo, informa sus primeras impresiones y clics con los días observados tras publicar. Los días sin observaciones quedan como desconocidos. |
| Citas de IA | Repite la misma pregunta en el mismo motor y registra también las respuestas sin cita. Para comparar exige por motor al menos tres respuestas repartidas en dos fechas por ventana de 28 días. Cuenta las citas que enlazan a la página intervenida. |
| Negocio | GA4 aporta sesiones y eventos clave según la configuración de la propiedad. La página de entrada puede recibir tráfico de distintos canales. Sus conversiones ayudan a priorizarla, pero atribuirlas a una consulta individual requiere otra evidencia. |

Si eliges Google e IA, cada objetivo conserva su resultado y cobertura. Los picos del panel señalan fechas que investigar. La decisión de cambiar, consolidar o retirar contenido corresponde al equipo tras revisar demanda, uso del negocio y enlaces.

## 4. Leer el análisis diario

Tras una revisión diaria o manual, el analista guarda un informe que combina comprobaciones técnicas, oportunidades editoriales y comparaciones semanales. El modelo estadístico se ajusta al historial de cada serie en el servidor. Estima la tendencia y el nivel propio de cada día de la semana y evalúa las estimaciones sobre semanas posteriores a los datos de entrenamiento. Compara el error con repetir la última semana. Publica una proyección de siete días solo con fechas consecutivas, una fuente suficientemente reciente, actividad suficiente y un error aceptable. El rango expresa el error observado en la validación. Las series de clics, impresiones, sesiones y eventos clave se interpretan por separado.

En el servidor local se puede configurar `SEO_OLLAMA_MODEL` para que Ollama proponga el orden de lectura de los hallazgos. El informe estadístico funciona también en el alojamiento compartido y cuando Ollama está apagado.

La clave de **Mi IA** solo se utiliza al pulsar **Generar con** en Keywords. La petición incluye los términos, variantes, acción y objetivo editorial. Las métricas se adjuntan en SEOBESTIA. El servidor conserva la clave cifrada durante la sesión y las credenciales quedan excluidas del respaldo. Los borradores generados están disponibles para esa sesión durante una hora. Al convertir uno en encargo, el equipo comparte su texto, evidencia y procedencia. [OpenAI Docs](https://developers.openai.com/api/docs/guides/structured-outputs) · [Claude Messages](https://platform.claude.com/docs/en/api/http/messages/create) · [Gemini generateContent](https://ai.google.dev/api/generate-content).

## Referencias de producto

El inventario filtrable y la navegación de enlaces toman como referencia el flujo de trabajo de SEO Spider. Su renderizado de JavaScript y su extracción personalizada quedan fuera del alcance del piloto. El catálogo de Can I Vibe Code It y su ficha de Frase sirvieron para estudiar el paso desde investigación a encargo editorial. El taller utiliza los datos del propio sitio. [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/) · [Catálogo de herramientas SEO](https://canivibecodeit.com/category/seo-marketing) · [Ficha de Frase](https://canivibecodeit.com/frase).
