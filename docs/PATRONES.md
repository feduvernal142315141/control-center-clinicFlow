# Patrones de implementación

Estas convenciones se observan en el código actual. Usa el ejemplo del mismo dominio como
referencia y adapta el alcance al cambio. Las restricciones están en [REGLAS.md](REGLAS.md).

## Contrato → endpoint → hook → vista

1. Define entradas y salidas en `src/lib/api/schemas/` y exporta los contratos necesarios
   desde su `index.ts`. Infiere tipos con `z.infer` y reutiliza `reasonSchema`,
   `versionSchema`, `isoDateTime` y `pageSchema` cuando corresponda.
2. Agrega la llamada en `endpoints/platform.ts` o `auth.ts`, con esquema de respuesta.
   Usa `schema: undefined` para respuestas sin cuerpo. Codifica IDs de path y propaga
   `AbortSignal` en lecturas; el cliente deja pasar la cancelación sin convertirla en fallo de red.
3. Declara claves en `query-keys.ts` e integra `useQuery` o `useMutation` en el hook del dominio.
4. Usa ese hook desde la vista y representa carga, vacío, error y resultado.
5. Si cambia el contrato, actualiza handlers/semillas y pruebas de comportamiento afectadas.

Ejemplo completo: [`clinic.ts`](../src/lib/api/schemas/clinic.ts) →
[`platform.ts`](../src/lib/api/endpoints/platform.ts) →
[`use-clinics.ts`](../src/lib/api/hooks/use-clinics.ts) →
[`clinics-list.tsx`](../src/components/clinics/clinics-list.tsx).

## Caché e invalidación por impacto

Las claves centralizadas permiten invalidar una familia de recursos. `useInvalidateClinic`
actualiza el detalle recibido e invalida clínicas, dashboard y auditoría. Los cambios de
catálogo invalidan planes, módulos, especialidades, clínicas, dashboard y auditoría.
Al agregar un efecto de negocio, revisa también las consultas derivadas y vistas previas.

`createQueryClient` define `staleTime: 30_000`, desactiva el refetch por foco y no reintenta
mutaciones. En consultas reintenta hasta dos veces los fallos de red, 5xx o errores no tipados;
los errores API 4xx no se reintentan automáticamente.

## Formularios y concurrencia

[`plan-form.tsx`](../src/components/plans/plan-form.tsx) muestra el patrón React Hook Form +
`zodResolver`, errores por campo con `applyFieldErrors`, bloqueo mientras guarda y adopción
de la respuesta confirmada por el servidor.

Para entidades versionadas usa [`useOptimisticVersion`](../src/lib/use-optimistic-version.ts):
envía `baseVersion`; ante `VERSION_CONFLICT`, recarga la versión y conserva los cambios
locales, mostrando `ConflictBanner`. El usuario puede descartar sus cambios o volver a guardar.
Un refetch no debe reiniciar un formulario sucio. No es una actualización optimista de caché:
es control de concurrencia con una versión base.

Si el formulario presenta sus errores, usa `meta: { errorToast: false }` para evitar
notificaciones duplicadas. Los errores de sesión se procesan globalmente y los conflictos
de versión se presentan en cada formulario.

## Filtros y tablas

Mantén filtros y página en la query string, con valores validados y página inicial cero.
Reutiliza [`useSearchParamsUpdater`](../src/lib/use-search-params-updater.ts), que conserva
la última URL pendiente para evitar que dos actualizaciones consecutivas se sobrescriban.
Cambiar filtros vuelve a la primera página; clínicas aplica debounce de 300 ms a la búsqueda.
`keepPreviousData` conserva filas mientras llega la siguiente página.

Usa [`DataTable`](../src/components/ui/data-table.tsx) y las APIs instaladas de TanStack Table;
el proyecto declara la versión 9. No copies ejemplos de otra versión sin contrastarlos.

## Módulos, planes y reglas comerciales

La UI muestra módulos efectivos o solicita una vista previa al backend con `planCode` o
`specialtyCode`; no recalcula derechos. La simulación en `mocks/effective.ts` aplica:
bloqueo por clínica suspendida/inactiva → módulo inactivo → kill switch → especialidad →
core → override vigente → plan; después apaga dependencias faltantes hasta llegar a un punto fijo.

La matriz de plan y la lista de overrides se envían completas, no como parches parciales.
Omitir un módulo en la matriz lo deja OFF; omitir un override lo elimina. Un límite `null`
significa ilimitado; cero sigue siendo cero. Las claves permitidas vienen de `allowedLimits`.

La detección local de ciclos en [`dependency-graph.ts`](../src/lib/dependency-graph.ts) da
feedback temprano; el backend sigue validando. Los códigos de planes y módulos no se editan.
No existe eliminación de módulos en V1; su desactivación usa consulta de impacto y motivo.
El detalle de decisiones D1–D19 permanece en el README.

## Fechas, auditoría y diseño

Las fechas del contrato son ISO con offset. Los inputs representan fechas en la zona del
navegador; usa `dates.ts` y revisa si el flujo requiere inicio o fin de día. Overrides vence
al final del día elegido y auditoría envía el rango de días locales completo.

[`audit-diff.ts`](../src/lib/audit-diff.ts) compara estructuras anidadas y arreglos identificados
por `moduleCode`, `code` o `id`. Conserva el fallback para acciones de auditoría y motivos
de denegación desconocidos: una ampliación del backend no debe romper la presentación.

Los componentes usan tokens de `globals.css`, primitivas Radix/shadcn, texto de UI en español
y estados acompañados de texto o iconos. `FormField` propaga atributos de accesibilidad.
El tema se resuelve por sistema o cookie `kw_theme`, con lectura inicial en servidor.

## Pruebas por capa

| Cambio                | Referencia y comprobación útil                                                     |
| --------------------- | ---------------------------------------------------------------------------------- |
| Contratos/transporte  | `src/lib/api/client.test.ts`: JSON inválido, error HTTP y contrato incompatible    |
| Sesión/BFF            | `src/server/bff.test.ts`, `src/middleware.test.ts`: cookies, CSRF, refresh y rutas |
| Formulario versionado | `src/components/plans/plan-form.test.tsx`: errores y conflicto conservando edición |
| Reglas simuladas      | `src/mocks/mocks.test.ts`: precedencia, dependencias y restricciones               |
| Listas y acciones     | Tests junto a componentes usando `setupMockApi` y `renderWithClient`               |
| Recorrido completo    | `e2e/`: autenticación, clínicas, catálogo y MVP con BFF mock                       |

Los helpers de componentes reinician la base simulada y handlers para aislar casos.
Selecciona pruebas por comportamiento modificado y evita añadir tests que solo verifiquen
el texto de una guía o repliquen la implementación.
