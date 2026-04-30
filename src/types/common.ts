export type NumericValue = number | string | null | undefined;

export type DbValue = string | number | boolean | Date | null | undefined;

export type DbRow = Record<string, DbValue>;

export type DataRow = Record<string, unknown>;

export type SyncResult = {
    appended: number;
    total: number;
};

export type SyncResults = Record<string, SyncResult>;
