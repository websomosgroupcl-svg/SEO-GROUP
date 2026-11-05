# SEOBESTIA · Propuesta del piloto

4 de noviembre de 2026 · Punto 3 · Alcance propuesto para el punto 4

## Primera entrega para el equipo

El equipo puede trabajar con varias webs autorizadas. Para probar el recorrido editorial de principio a fin, elegirá una que tenga historial en Search Console o una exportación de consultas. Al abrir el **Plan del sitio**, una persona podrá elegir una oportunidad, ver qué página la atiende, preparar un cambio y volver después para comprobar qué ocurrió.

Ejemplo ilustrativo. Una tienda de muebles ya recibe impresiones por «escritorio de madera para espacios pequeños». El equipo abre la consulta y ve la categoría que aparece, el país, el período, los clics y la posición media. Si la categoría ofrece esos escritorios pero omite sus medidas, la acción propuesta es mejorar esa categoría. El brief pide incorporar medidas verificadas, responder cómo elegir tamaño y enlazar los modelos adecuados. Una variante sugerida como «escritorio angosto para dos monitores» queda pendiente de validar. Tras publicar, el equipo registra la URL y la fecha. SEOBESTIA podrá comprobar la modificación en la siguiente revisión y comparar rendimiento cuando haya suficientes datos.

## Qué construiremos y cómo se aceptará

| Orden | Entrega | Prueba que debe pasar |
|---|---|---|
| 1 | Acceso privado, alta de sitio, almacenamiento, respaldo y revisión programada por fecha local. | Dos ciclos diarios con la interfaz cerrada, recuperación de un trabajo interrumpido sin duplicados, acceso restringido al sitio permitido y restauración de una copia. |
| 2 | Diagnóstico técnico y primera pantalla Hoy. Rastrear las páginas autorizadas y comprobar estados HTTP, enlaces internos, títulos, canónicas e instrucciones de indexación. | Un problema conocido muestra URL, evidencia, corrección y fecha. Tras corregirlo en una página de prueba, la siguiente comprobación lo marca resuelto. El score indica cobertura y reglas que explican la nota. |
| 3 | Investigación de keywords y long-tail. Importar consultas reales, agrupar por intención y proponer mantener, mejorar o crear página. | Para una consulta observada se puede volver al dato original. Para una sugerencia sin demanda conocida se conserva ese estado en pantalla y exportación. Una persona del equipo revisa relevancia comercial y página destino. |
| 4 | Brief editable y tarea con responsable. Registrar versión, URL y fecha del cambio externo. | El equipo puede preparar un brief sin clave de IA, aplicarlo en su gestor de contenidos y recuperar la versión anterior. |
| 5 | Seguimiento diario de cambios, alertas y resultados. | Una página nueva con pocos datos queda en observación. Un enlace roto genera una alerta con evidencia. Una fuente caída indica revisión parcial. Alrededor de 28 días se comparan períodos equivalentes si hay muestra suficiente. |

El primer hito técnico es el 1. La primera entrega **útil para el trabajo editorial** comprende los cinco hitos sobre la misma web. La ampliación a otros sitios dependerá del consumo y la calidad observados.

## Dónde correrá y qué hay que conectar

| Recurso | Responsable al preparar el piloto | Función |
|---|---|---|
| Netlify Free y Neon Free | Administrador del proyecto | Alojar la web privada, ejecutar trabajos y conservar los datos en PostgreSQL. Los miembros entran por un enlace con acceso individual. |
| Una web y una propiedad de Search Console | Responsable del sitio | Autorizar el rastreo y conceder lectura para sincronizar consultas y páginas. Un archivo exportado permite trabajar mientras se habilita el acceso. Sus datos conservan la fecha de exportación hasta la próxima carga. |
| Perfil del negocio | Equipo editorial | Indicar servicios prioritarios, idioma, país y objetivos. Esto permite valorar una long-tail comercial aunque tenga poca demanda. |
| Fuentes complementarias | Administrador, cuando estén disponibles | PSI y CrUX para rendimiento. GA4 si existen conversiones configuradas. Keyword Planner solo con acceso existente apto sin gasto. El flujo principal funciona con Search Console, rastreo y edición manual. |

Las cuentas y secretos se configurarán durante el despliegue en los proveedores correspondientes. La propuesta parte de los planes y condiciones revisados en el [informe de viabilidad](VIABILIDAD_Y_ARQUITECTURA_GRATUITA.md).

## Rutina diaria y decisiones humanas

El planificador comprobará cada hora qué sitio tiene pendiente su revisión diaria en America/Santiago. Tendrán prioridad las páginas nuevas o modificadas, las incidencias abiertas y las consultas con datos nuevos. El rastreo amplio se repartirá semanalmente. Hoy distinguirá la hora de la revisión, la fecha del último dato de búsqueda y las páginas efectivamente comprobadas.

SEOBESTIA recomendará mantener, esperar, corregir, mejorar, consolidar, redirigir o retirar una página. El equipo validará el objetivo comercial, las fuentes y el contenido, aplicará el cambio en su web y registrará la fecha. Para una retirada revisará también enlaces, conversiones disponibles y una posible página sustituta. La evidencia de una cita en Google o IA podrá añadirse manualmente con pregunta, URL y fecha.

## Límites y decisión de ampliar

El escenario presupuestado es de tres sitios pequeños y cinco miembros. Empezar con una sola web permitirá medir cuánto cuesta en cuota una revisión completa, cuánto crece el historial y qué oportunidades resultan útiles. Si la proyección mensual invade la reserva definida en viabilidad, se reducirán cargas históricas y rastreos secundarios antes de añadir sitios. Agotar un límite del proveedor puede interrumpir el servicio hasta el siguiente ciclo.

Para una web sin historial, la entrega inicial será un diagnóstico y una lista de candidatos editoriales con su evidencia disponible. El volumen de búsquedas puede quedar desconocido. Las posiciones y citas se evaluarán mediante observaciones posteriores. La revisión del rendimiento editorial requiere datos suficientes aunque el sistema se ejecute todos los días.

El piloto se considerará listo para ampliar cuando haya completado el recorrido con una oportunidad real, demostrado ejecución diaria y restauración, y medido un consumo compatible con el presupuesto gratuito.

## Punto 5 del proyecto · Validar SEOBESTIA con el equipo

Se evalúa si una persona puede pasar de un hallazgo a una decisión explicable y repetir el recorrido en otro sitio. El equipo puede elegir cualquier web autorizada para cada prueba. El historial de búsqueda se necesita para evaluar rendimiento editorial; el alta, los permisos, la auditoría y el diagnóstico puntual pueden probarse desde el primer día.

1. Trabajar con dos sitios distintos y comprobar que cada uno conserva sus conexiones, accesos, métricas y tareas. Ejecutar también un diagnóstico puntual y verificar que el directorio mantiene el mismo número de sitios.
2. Pedir a un integrante que priorice una corrección técnica y a un redactor que prepare un encargo desde una keyword o long-tail con evidencia. Registrar dónde necesitaron ayuda, qué dato justificó la decisión y si pudieron explicarla a otra persona.
3. Volver tras la revisión diaria para comprobar el cambio técnico. Para contenido publicado, comparar los períodos cuando exista muestra suficiente. El inicio de la etapa es independiente de los resultados SEO de cualquier dominio concreto.
