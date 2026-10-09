# Guía de trabajo del Control Center

Este repositorio contiene `kodewave-control-center`, el panel interno de KodeWave para
administrar ClinicFlow360. El backend Spring Boot se mantiene fuera de este repositorio.
Stack: Next.js 15, React 19, TypeScript estricto, Tailwind 4, TanStack Query/Table y Zod.
Arquitectura: vistas y hooks → cliente API → BFF Next → backend `/platform/**`.

## Contexto y reglas

- Consulta [estructura](docs/ESTRUCTURA.md) para ubicar una responsabilidad.
- Consulta [patrones](docs/PATRONES.md) al implementar o modificar un flujo.
- Aplica las [reglas del proyecto](docs/REGLAS.md) al trabajar en este repositorio.
- El [README](README.md) mantiene la operación local, los contratos propuestos y las
  decisiones de negocio D1–D19. Contrasta los documentos con el código si difieren.
- Para implementar o revisar flujos API/formulario del panel, usa cuando aporte la skill
  [clinicflow-control-center](.agents/skills/clinicflow-control-center/SKILL.md).
  No la cargues para texto, configuración mínima o trabajo ajeno a ese flujo.

## Flujo de trabajo

Ubica primero el contrato Zod, endpoint, hook, componente y pruebas del recurso afectado.
Conserva la separación navegador → BFF → `/platform/**`; el navegador no maneja tokens.
Actualiza los mocks cuando cambie un contrato y distingue su comportamiento del backend real.
Aplica SOLID/Clean Code de forma pragmática: responsabilidades concretas, bajo acoplamiento,
nombres claros y reutilización útil. No introduzcas capas, refactors ni limpieza fuera de alcance.

Usa los scripts de `package.json` y el gestor declarado allí; conserva `pnpm-lock.yaml`.
No desactives comprobaciones de TypeScript, ESLint o Next para hacer pasar un cambio.
No modifiques archivos ajenos a la tarea ni formatees todo el repositorio por un cambio local.

## Contexto y ejecución proporcional

Un agente por defecto; Graphify ante incertidumbre; subagentes cuando reduzcan riesgo real.
Clasifica cada tarea en el nivel más bajo seguro: TRIVIAL, SMALL, MEDIUM o LARGE.
Empieza por manifests/configuración, búsquedas dirigidas y pocos ejemplos relevantes.
Reutiliza contexto verificado; no recorras todo `src/` ni regeneres grafos por rutina.

Graphify es opcional: úsalo para relaciones o impacto que `rg` y la lectura dirigida no resuelvan,
o por solicitud explícita. Evítalo en cambios triviales/localizados con archivos conocidos.
No leas `graph.json` completo ni explores recursivamente `graphify-out/` sin necesidad.

Implementa con el agente principal. Delega solo una pregunta acotada con valor claro,
contexto existente, archivos permitidos y resultado esperado; reviewers de solo lectura
cuando sea posible. No dupliques descubrimiento ni asignes los mismos archivos a varios agentes.
No se requieren agentes permanentes ni agentes por tecnología.

Consulta [flujo IA y Definition of Done](docs/FLUJO_IA.md) para clasificación, delegación y
comandos de validación. Elige comprobaciones según el impacto; `pnpm check` es la suite
completa de integración, no un requisito para cualquier edición. Termina con self-review,
revisión del diff y resultados reales. Un E2E con mocks no verifica el backend externo.
