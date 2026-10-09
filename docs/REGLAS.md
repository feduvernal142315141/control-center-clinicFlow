# Reglas del proyecto

Estas reglas preservan los límites y contratos actuales. `AGENTS.md` remite a este documento;
no es un archivo de permisos del ejecutor ni una configuración autónoma de ESLint.
Los cambios explícitos de requisitos pueden modificar estas convenciones junto con su código,
documentación y pruebas.

## SOLID y Clean Code con alcance limitado

Mantén responsabilidades concretas, bajo acoplamiento, alta cohesión, nombres expresivos,
funciones enfocadas y manejo coherente de errores. Reutiliza lo que aporta claridad y evita
duplicación relacionada con el cambio. Prioriza simplicidad y patrones existentes.
Estos principios no justifican interfaces, capas, abstracciones, cambios de contratos o
refactors ajenos a la tarea. Reporta la deuda técnica incidental sin corregirla automáticamente.

## Arquitectura y seguridad de sesión

- Consume recursos de plataforma desde la UI mediante `platformApi`/hooks y el cliente API;
  el tráfico va a `/api/platform/**` y el BFF a `/platform/**`.
- Maneja login, MFA y logout mediante `/api/auth/**`. Conserva el bloqueo de `auth` en el proxy.
- Mantén tokens en cookies de servidor `httpOnly`, `Secure`, `SameSite=Strict`.
  No los devuelvas al navegador, imprimas en logs ni los guardes en Web Storage.
- Conserva la verificación de origen para mutaciones y las respuestas de sesión `no-store`.
- Trata el middleware como filtro de presencia de sesión. La autorización procede del backend.
- Conserva el refresh acotado y su deduplicación. No agregues reintentos automáticos a mutaciones.
- La UI no importa `server/` o `mocks/`. Los route handlers pueden importar `server/`;
  el transporte de servidor selecciona los mocks. Los tests pueden usar fixtures y helpers.
- No añadas secretos a `NEXT_PUBLIC_*`; esas variables se incorporan al build.
  `ALLOW_MOCKS_IN_PRODUCTION=true` se reserva a E2E/CI.
- No copies valores de `.env`, credenciales ni datos sensibles a guías, logs o ejemplos.
  Documenta nombres y mecanismos. No alteres infraestructura, permisos o producción como
  efecto lateral de una tarea local.

## Contratos y negocio

- Define contratos en Zod e infiere los tipos. Mantén la validación de respuestas y errores
  tipados; no sustituyas errores por datos vacíos o éxito aparente.
- Usa `version` en las escrituras que la exigen. Ante un conflicto, conserva el formulario
  y muestra la opción de recargar/descartar; no reenvíes cambios silenciosamente.
- Conserva motivos auditables donde el contrato los requiere. `reasonSchema` valida entre
  10 y 500 caracteres después de eliminar espacios exteriores.
- Mantén inmutables los códigos de plan y módulo. Respeta las restricciones de core,
  dependencias, límites permitidos y desactivación descritas en README y schemas.
- Envía matrices y overrides completos cuando el endpoint tiene semántica de reemplazo.
- No calcules módulos efectivos en componentes. Usa el endpoint o su vista previa.
- Actualiza invalidaciones, mocks y pruebas relevantes cuando cambie un recurso compartido.
- Distingue comportamiento simulado y contrato propuesto de integración real comprobada.

## Código y experiencia de usuario

- Usa TypeScript estricto; ESLint prohíbe `any` explícito y variables sin uso no exceptuadas.
- Conserva archivos en kebab-case, componentes en PascalCase y hooks con prefijo `use`.
- Usa primitivas existentes, tokens semánticos y helpers de formulario/fechas antes de duplicarlos.
- Presenta carga, vacío, error y éxito; no dependas solo del color para comunicar estado.
- Mantén filtros compartibles en URL y las fechas según la zona del navegador.
- Respeta `.prettierrc.json`; formatea únicamente los archivos del cambio.
- No añadas `ignoreBuildErrors` ni `ignoreDuringBuilds` a Next ni desactives reglas globales
  para ocultar un fallo local.

## Herramientas y entrega

`package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `eslint.config.mjs` y los archivos de
configuración de pruebas son la referencia ejecutable. Usa Node 22+ y el pnpm declarado.
No regeneres el lockfile con otra versión de gestor como efecto lateral de documentar.

Aplica la [Definition of Done proporcional](FLUJO_IA.md): para código, selecciona tipos, lint,
pruebas y build según impacto; usa `pnpm check` para integración amplia o cuando se solicite.
Para documentación, valida enlaces y formato; no reconstruyas la aplicación por rutina.
Reporta bloqueos del entorno y resultados reales, sin presentar verificaciones pendientes como aprobadas.
