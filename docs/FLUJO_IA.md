# Flujo IA y Definition of Done

Principio: un agente por defecto, Graphify ante incertidumbre y subagentes cuando reduzcan
riesgo. Esta guía complementa `AGENTS.md`; no cambia permisos de herramientas ni configura
modelos, presupuestos o ejecución automática.

## Clasificar y obtener contexto

Elige el nivel más bajo seguro por impacto y riesgo, no solo por número de archivos.

| Nivel   | Ejemplo en este proyecto                                                    | Flujo                                                                                        |
| ------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| TRIVIAL | Texto, enlace, ajuste mínimo de documentación                               | Cambio directo, comprobación mínima y diff; sin Graphify ni agentes                          |
| SMALL   | Vista o helper localizado sin cambio de contrato                            | Inspección dirigida, cambio, validación afectada y self-review                               |
| MEDIUM  | Schema, endpoint, hook y formulario de un recurso conocido                  | Plan interno breve, rastreo entre capas, implementación y validación por impacto             |
| LARGE   | Sesión/seguridad, concurrencia, contrato transversal o integración incierta | Inspección, Graphify si resuelve dudas, especialista si aporta, revisión y validación amplia |

Empieza por el manifiesto/configuración y el área solicitada; usa `rg` para encontrar
consumidores y pocos ejemplos representativos. No repitas el análisis inicial completo.
No clasifiques una corrección textual como LARGE solo por estar en un archivo de autenticación.
Si aparece una dependencia inesperada, revisa el alcance antes de continuar.

## Graphify bajo demanda

Está disponible en el entorno donde se preparó esta configuración, pero no es una dependencia
del proyecto ni un requisito de CI. No hay grafo versionado en la raíz: el análisis anterior
se generó temporalmente y no debe suponerse disponible en otro checkout.

Úsalo para impacto transversal, relaciones desconocidas o cuando búsqueda/lectura dirigida
sean insuficientes. Si hay grafo, comprueba alcance y vigencia y consulta la pregunta concreta;
no cargues todo el JSON ni regeneres automáticamente. Si falta, decide si construir un grafo
acotado compensa su costo. Contrasta los hallazgos con el código. Si la herramienta no existe,
usa búsqueda dirigida y comunica la incertidumbre restante.

Evítalo en TRIVIAL, SMALL localizada, archivos conocidos o contexto ya suficiente. Esta política
específica del proyecto restringe el disparador genérico de la skill Graphify. No altera su
instalación global ni impone el mismo criterio a otros proyectos.

## Delegación excepcional

El agente principal implementa e integra los resultados. Antes de delegar define pregunta,
valor, contexto mínimo ya obtenido, archivos permitidos, restricciones y resultado esperado.
El valor debe superar el costo de duplicar contexto y coordinar.

Ejemplo: revisar si un cambio concreto en `src/server/bff.ts` y `session.ts` introduce
exposición de tokens o errores de refresh; entregar hallazgo, impacto, ubicación, riesgo,
recomendación y validación necesaria. El reviewer no modifica archivos ni redescubre el repo.

No hay agentes permanentes. Un reviewer de seguridad, concurrencia, contratos o accesibilidad
puede ser temporal y de solo lectura cuando el riesgo lo justifique y la plataforma lo permita.
No se crean agentes porque el proyecto use React/Next. Paraleliza solo tareas independientes.
Delega implementación únicamente con archivos aislados, sin escritores concurrentes y con
una reducción concreta de complejidad. No uses delegación para evitar restricciones del entorno.

## Comandos reales y uso

Ejecuta desde la raíz con el pnpm declarado en `package.json`. Los comandos de scripts
provienen de ese manifiesto; los filtros siguen las herramientas configuradas en el repo.

| Comando                                 | Cuándo aporta                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm typecheck`                        | Cambios TypeScript, props, contratos o hooks                                  |
| `pnpm lint`                             | Cambios de código y límites de imports; la configuración exige cero warnings  |
| `pnpm exec prettier --check <archivos>` | Solo los documentos o fuentes editados                                        |
| `pnpm test <ruta.test.tsx>`             | Prueba Vitest existente del comportamiento afectado                           |
| `pnpm test`                             | Impacto compartido que requiere todo el conjunto Vitest                       |
| `pnpm build`                            | Rutas/layouts, límites cliente-servidor, configuración o empaquetado          |
| `pnpm e2e`                              | Recorrido completo, sesión o navegación; construye/inicia la app mock en 3100 |
| `pnpm check`                            | Integración amplia: tipos, lint, formato global, Vitest y build               |
| `pnpm format:check`                     | Verificación global de formato para integración/CI                            |

Sustituye los argumentos entre `<...>` por archivos reales; no ejecutes los placeholders.
No uses `pnpm format` por rutina: formatea todo el repositorio. CI conserva sus comprobaciones
completas; esta guía solo evita ejecutarlas indiscriminadamente para cada cambio local.

## Definition of Done por impacto

- **Documentación/configuración IA:** enlaces y rutas válidos, reglas sin contradicciones,
  formato de archivos editados, frontmatter/metadatos válidos para skills. No requiere build
  ni pruebas de aplicación cuando no cambia comportamiento.
- **UI TypeScript localizada:** tipos y lint, pruebas relevantes si cambia comportamiento;
  revisar carga/error/vacío, accesibilidad y tokens cuando corresponda. Build si afecta rutas,
  límites RSC/cliente o compilación; E2E si el recorrido queda fuera de las pruebas de componentes.
- **API/hooks/formularios:** validar schema, errores, cancelación, invalidación, versiones y
  conservación de formularios sucios; ajustar mocks y tests afectados. No confundir fixtures
  que omiten autenticación con pruebas del BFF.
- **Sesión/BFF/seguridad:** revisar cookies, origen, autorización delegada al backend, refresh,
  inputs y exposición de secretos. Ejecutar pruebas de BFF/middleware afectadas y E2E de sesión
  cuando cambie su recorrido; revisión especializada solo si disminuye riesgo material.
- **Cambios transversales o integración:** `pnpm check` y E2E relevantes; contrastar con el
  backend real solo si está disponible y dentro del alcance autorizado. Evitar repetir build
  innecesariamente: el comando E2E ya construye la app con su configuración mock.
- **Persistencia:** este repo no contiene ORM ni migraciones de base de datos. Los mocks usan
  memoria. No inventar validaciones SQL o comandos Spring; si la tarea afecta persistencia
  real, identificar primero el repositorio responsable y su contrato.

En todos los casos: comportamiento solicitado completo, arquitectura preservada, cambio mínimo,
self-review y diff final. Reporta pruebas ejecutadas/fallidas/pendientes y riesgos concretos.
No agregues tests que solo repitan implementación o comprueben el texto de estas instrucciones.

## Configuración y portabilidad

La skill del proyecto reside en `.agents/skills/clinicflow-control-center/`; las rutas internas
se resuelven desde la raíz verificada. No necesita rutas de usuario ni servicios externos.
Esta ubicación sigue la [documentación oficial de skills](https://learn.chatgpt.com/docs/build-skills).
`AGENTS.md` es la entrada de instrucciones del repo, según la
[guía oficial](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

No se crea `.codex/config.toml`: las reglas solicitadas caben en `AGENTS.md` y esta guía;
no hay ajustes de runtime específicos que justifiquen fijar modelos, permisos o agentes.
No se crean archivos de reglas de ejecución: las convenciones de desarrollo no deben ampliar
autorizaciones de comandos. Solo añade skills o agentes permanentes ante workflows recurrentes.
