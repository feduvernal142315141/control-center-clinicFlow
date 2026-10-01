'use client';

import { tableFeatures, useTable, type ColumnDef, type RowData } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

/** Sin features cliente: ordenar, filtrar y paginar lo hace el backend. */
export const dataTableFeatures = tableFeatures({});

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  empty,
  caption,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ColumnDef mezcla TValue distintos por columna
  columns: ColumnDef<typeof dataTableFeatures, TData, any>[];
  data: TData[];
  getRowId?: (row: TData) => string;
  empty?: React.ReactNode;
  caption?: string;
}) {
  const table = useTable({ features: dataTableFeatures, columns, data, getRowId });
  const rows = table.getRowModel().rows;
  return (
    <Table>
      {caption && <caption className="sr-only">{caption}</caption>}
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            {group.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="p-0">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
