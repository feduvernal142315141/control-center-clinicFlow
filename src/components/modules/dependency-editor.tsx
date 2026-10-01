'use client';

import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { API_ERROR_CODES, isApiError } from '@/lib/api/errors';
import type { PlatformModule } from '@/lib/api/schemas';
import {
  findDependencyIssue,
  formatDependencyPath,
  type DependencyIssue,
} from '@/lib/dependency-graph';

const cycleDetailsSchema = z.object({ cycle: z.array(z.string()).min(2) });

/** Error de dependencias que mandó el backend (manda sobre la validación local). */
export function backendDependencyError(
  error: unknown,
): { message: string; path?: string[] } | null {
  if (
    !isApiError(error) ||
    (error.code !== API_ERROR_CODES.MODULE_DEPENDENCY_CYCLE &&
      error.code !== API_ERROR_CODES.MODULE_DEPENDENCY_SELF)
  ) {
    return null;
  }
  const details = cycleDetailsSchema.safeParse(error.details);
  return { message: error.message, path: details.success ? details.data.cycle : undefined };
}

export function useDependencyIssue(
  catalog: PlatformModule[],
  code: string,
  dependsOn: string[],
): DependencyIssue | null {
  return useMemo(
    () => (code ? findDependencyIssue(catalog, code, dependsOn) : null),
    [catalog, code, dependsOn],
  );
}

/**
 * Selector de dependencias con feedback inmediato de auto-dependencia y ciclos (DFS).
 * La validación que manda es la del backend: su error se muestra igual si llega.
 */
export function DependencyEditor({
  catalog,
  code,
  value,
  onChange,
  issue,
  backendError,
}: {
  catalog: PlatformModule[];
  /** Código del módulo editado (o el que se está escribiendo al crear). */
  code: string;
  value: string[];
  onChange: (next: string[]) => void;
  issue: DependencyIssue | null;
  backendError: { message: string; path?: string[] } | null;
}) {
  const toggle = (dep: string, checked: boolean) =>
    onChange(checked ? [...value, dep] : value.filter((d) => d !== dep));

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Dependencias</legend>
      <p className="text-xs text-muted-foreground">
        Módulos que deben estar ON para que este funcione.
      </p>
      <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
        {catalog.map((m) => (
          <label key={m.code} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={value.includes(m.code)}
              onChange={(e) => toggle(m.code, e.target.checked)}
            />
            <code className="font-mono text-xs">{m.code}</code>
            {m.code === code && <span className="text-xs text-muted-foreground">(este)</span>}
          </label>
        ))}
      </div>
      {issue && (
        <Alert variant="destructive" data-testid="dependency-issue">
          <AlertTriangle />
          <AlertTitle>
            {issue.kind === 'SELF'
              ? 'Un módulo no puede depender de sí mismo'
              : 'Ciclo de dependencias'}
          </AlertTitle>
          <AlertDescription>
            <code className="font-mono">{formatDependencyPath(issue.path)}</code>
          </AlertDescription>
        </Alert>
      )}
      {!issue && backendError && (
        <Alert variant="destructive" data-testid="dependency-backend-error">
          <AlertTriangle />
          <AlertTitle>El backend rechazó las dependencias</AlertTitle>
          <AlertDescription>
            <p>{backendError.message}</p>
            {backendError.path && (
              <code className="font-mono">{formatDependencyPath(backendError.path)}</code>
            )}
          </AlertDescription>
        </Alert>
      )}
    </fieldset>
  );
}
