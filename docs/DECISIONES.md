# SEOBESTIA — Registro de decisiones

Fecha: 3 de noviembre de 2026. Alcance: investigación y arquitectura; sin implementación ni despliegue.

La especificación de producto conserva autoridad sobre las funciones y la gratuidad. Este registro concreta elecciones técnicas con el alcance y límites del [informe de viabilidad](VIABILIDAD_Y_ARQUITECTURA_GRATUITA.md).

| ID | Decisión | Motivo y condición |
|---|---|---|
| ADR-001 | Search Console como fuente principal de oportunidades observadas. | Datos del sitio autorizado; extracción limitada, no índice completo de mercado. Mantener totales y detalles separados. |
| ADR-002 | Keyword Planner opcional condicionado. | Requisitos de cuenta y aprobación impiden garantizar acceso universal. No activar campañas ni gasto. Importación como alternativa. |
| ADR-003 | Separar oportunidades observadas de candidatos por validar. | Investigar long-tail sin inventar volúmenes ni dificultad de mercado. |
| ADR-004 | Netlify Free para la aplicación y trabajos del piloto. | Cron y background nativos, sin prueba temporal. Límite duro de créditos; certificación mediante carga real pendiente. |
| ADR-005 | PostgreSQL en Neon Free, contratado directamente bajo cuenta del propietario. | Transacciones y portabilidad a servidor propio; cuotas independientes del hosting. No confundir con Netlify Database. |
| ADR-006 | Objetos privados de Neon para archivo y exportaciones de respaldo. | Capacidad gratuita publicada; probar acceso, transferencia y restauración. Copia externa semanal descargada por administrador. No depender del restore nativo ambiguo. |
| ADR-007 | Tick horario y cola durable para revisión diaria local. | America/Santiago con zona IANA, deduplicación por sitio y fecha, cursores y bloqueos con vencimiento. No depender de abrir la interfaz. |
| ADR-008 | Reutilizar librerías; no hacer fork completo de una suite. | Crawlee HTTP, Cheerio y Readability; referencias de SerpBear, OpenSEO, SEOnaut y prompts. Evitar dependencia de datos pagados. |
| ADR-009 | Renderizado selectivo y pruebas con Playwright. | No prometer browser crawling masivo en Free. Un sitio que requiera render obliga a comprobar capacidad o declarar cobertura parcial. |
| ADR-010 | IA fuera de dependencias esenciales. | Evaluar Gemini gratuito o modelos locales más adelante; sin claves pagadas ni facturación automática. |
| ADR-011 | Presupuesto inicial para 3 sitios pequeños y 5 miembros. | Supuesto para medir, no límite universal probado. Controlar créditos, cómputo, almacenamiento y transferencia antes de crecer. |
| ADR-012 | Accesos propios de la aplicación. | Los usuarios del producto no necesitan asientos del proveedor de hosting. Administración privada sin registro público ni correo pagado. |
| ADR-013 | Plan alternativo Node + PostgreSQL sobre servidor existente. | Mantener lógica y datos; requerirá configurar despliegue, red, cron y respaldo. No afirmar que ese hardware ya existe. |

## Condiciones de salida del piloto técnico

Acceso real a fuentes, dos ciclos diarios sin interacción, recuperación de interrupción, consumo medido dentro del margen, aislamiento de accesos y restauración comprobada. Hasta entonces la viabilidad es documental, no una certificación operativa.

No se autorizan gastos, publicación automática en webs de clientes ni incorporación silenciosa de proveedores pagados para superar limitaciones.
