/**
 * Type shim for `grapify` (v1.0.7) — the package ships plain CommonJS with no
 * typings. Only the two exports it actually has are declared.
 */
declare module "grapify" {
  /** Success row from `School`. */
  export interface GrapifyPercentRow {
    Column: string;
    valuePercentage: number;
  }

  /** Row from `Graph` — values come back as the raw (string) input. */
  export interface GrapifyRow {
    ColumName: string;
    Value: string;
  }

  /** Error row: `School` returns these *instead of* data when input is bad. */
  export interface GrapifyErrorRow {
    ValueError?: string;
    NamingError?: string;
  }

  /**
   * `School(columnCount, maxValue, names, values)` — percentage of `maxValue`
   * per column. Returns `undefined` when its internal validator rejects the
   * input (it only `console.log`s).
   */
  export function School(
    lines: number,
    maxRange: number,
    names: { ColumsNames: string },
    values: { Values: string },
  ): (GrapifyPercentRow | GrapifyErrorRow)[] | undefined;

  /** `Graph(names, values)` — pairs the two comma-separated lists. */
  export function Graph(
    names: { ColumsNames: string },
    values: { Values: string },
  ): GrapifyRow[] | undefined;
}
