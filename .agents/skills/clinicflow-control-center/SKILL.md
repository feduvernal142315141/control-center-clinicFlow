---
name: clinicflow-control-center
description: Implementar o revisar flujos API y formularios versionados de kodewave-control-center con Zod, BFF y TanStack Query. No usar para texto, configuración mínima, backend Spring Boot u otros frontends de clínicas.
---

# Trabajar en ClinicFlow Control Center

Confirma que el repositorio activo tiene `name: kodewave-control-center` en `package.json`.
Resuelve las rutas siguientes desde esa raíz, no desde el directorio donde esté instalada
la skill. Si trabajas en otro proyecto, no apliques estas convenciones por similitud de nombre.

Inputs: cambio o revisión solicitada, recurso afectado y criterios de aceptación disponibles.
Si faltan rutas, identifícalas con búsqueda dirigida; pregunta solo por decisiones de producto
que no se puedan inferir. No requiere credenciales ni backend real para análisis local.

Lee `AGENTS.md` y `docs/REGLAS.md`. Consulta `docs/ESTRUCTURA.md` cuando necesites ubicar
responsabilidades y `docs/PATRONES.md` para el flujo afectado. Esos archivos viven en el
repositorio; si no están disponibles, inspecciona el código y no presupongas su contenido.
Clasifica el cambio según `docs/FLUJO_IA.md` y usa el mínimo contexto necesario. Un agente
por defecto; Graphify ante relaciones inciertas y delegación solo cuando reduzca riesgo.

## Elegir el recorrido

Para un recurso de plataforma, rastrea `src/lib/api/schemas/` → `endpoints/platform.ts` →
`api/hooks/` → `components/<dominio>/` → `app/(app)/`. Revisa las claves en
`api/query-keys.ts` y los consumidores derivados antes de cambiar la respuesta o invalidación.
Para autenticación, sigue `app/api/auth/` → `server/bff.ts` → `session.ts` y
`platform-backend.ts`; consulta también `lib/react-query.ts` y `middleware.ts`.

## Implementar el cambio

- Define o ajusta el esquema de entrada/salida y los tipos inferidos; usa el cliente API
  existente, `AbortSignal` para lecturas y `ApiError` para fallos. Evita fetch de negocio
  dentro de componentes.
- Usa hooks y claves centralizadas. Comprueba qué listas, detalles, previews, KPIs y auditoría
  deben invalidarse después de guardar. Toma `use-clinics.ts` o `use-catalog-admin.ts` como referencia.
- Para edición con versión, reutiliza `useOptimisticVersion` y `ConflictBanner`. Conserva
  cambios sucios ante refetch o 409 y adopta la respuesta del servidor después del éxito.
- Para formularios, sigue `components/plans/plan-form.tsx`: Zod, React Hook Form,
  `applyFieldErrors` y tratamiento local de errores sin toast duplicado.
- Para reglas comerciales, consulta decisiones D1–D19 del README y schemas del recurso.
  Presta atención a reemplazos completos de matriz/overrides, core inmutable, códigos
  inmutables y motivos auditables. Los módulos efectivos se solicitan al backend.
- Si cambia el contrato, ajusta `mocks/handlers.ts`, datos necesarios y pruebas afectadas.
  Los mocks no demuestran que Spring Boot soporte el contrato.

## Verificar y entregar

Conserva responsabilidades claras, nombres expresivos y patrones existentes; no introduzcas
abstracciones, refactors ni cambios de contratos ajenos al alcance por aplicar SOLID/Clean Code.

Usa `test/render.tsx` para pruebas de componentes, tests de BFF para sesión y Playwright
para flujos completos. Ejecuta las comprobaciones indicadas en `AGENTS.md` según el alcance;
usa el gestor y scripts de `package.json`. No alteres lockfile o configuración de calidad
para compensar un entorno incompleto.

Describe el comportamiento cambiado, archivos relevantes, pruebas realizadas y limitaciones.
Actualiza las guías solo si el cambio modifica una convención, estructura o contrato documentado.
