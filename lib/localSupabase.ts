// The project does not generate database types, so retain Supabase's dynamic row behavior.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DynamicValue = any;
type LocalRow = Record<string, DynamicValue>;

type LocalError = {
  message: string;
  code?: string;
};

type LocalResult<T> =
  | { data: T; error: null }
  | { data: null; error: LocalError | null };

type Filter = {
  column: string;
  operator: string;
  value: unknown;
};

const DATABASE_NAME = 'mp-lng-local';
const DATABASE_VERSION = 1;
const TABLE_STORE = 'tables';
const LOCAL_ADMIN: LocalRow = {
  id: 'admin',
  user_id: 'admin',
  name: '로컬 관리자',
  user_name: '로컬 관리자',
  email: 'admin@local',
  role: 'SUPER_ADMIN',
  department: '관리팀',
  password: '00000000',
  birth_date: '00000000',
  work_status: '근무중',
};

const tableListeners = new Map<string, Set<(payload: unknown) => void>>();
const photoUrls = new Map<string, string>();

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('이 브라우저에서는 IndexedDB를 사용할 수 없습니다.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TABLE_STORE)) {
        const store = database.createObjectStore(TABLE_STORE);
        store.put([LOCAL_ADMIN], 'app_users');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('로컬 데이터베이스를 열지 못했습니다.'));
    request.onblocked = () => reject(new Error('다른 탭에서 로컬 데이터베이스를 사용 중입니다. 탭을 닫고 다시 시도해주세요.'));
  });
}

function getValue(row: LocalRow, column: string): unknown {
  return column.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as LocalRow)[key];
  }, row);
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  const leftText = String(left);
  const rightText = String(right);
  if (leftText === rightText) return 0;
  return leftText < rightText ? -1 : 1;
}

function matchesFilter(row: LocalRow, filter: Filter): boolean {
  const value = getValue(row, filter.column);
  const expected = filter.value;

  switch (filter.operator) {
    case 'eq':
      return value == null || expected == null
        ? value === expected
        : String(value) === String(expected);
    case 'neq':
      return value == null || expected == null
        ? value !== expected
        : String(value) !== String(expected);
    case 'in':
      return Array.isArray(expected) && expected.some(item =>
        value == null || item == null ? value === item : String(value) === String(item)
      );
    case 'ilike':
    case 'not_ilike': {
      const pattern = String(expected ?? '')
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
      const matched = new RegExp(`^${pattern}$`, 'i').test(String(value ?? ''));
      return filter.operator === 'ilike' ? matched : !matched;
    }
    case 'gte':
      return compareValues(value, expected) >= 0;
    case 'lte':
      return compareValues(value, expected) <= 0;
    case 'gt':
      return compareValues(value, expected) > 0;
    case 'lt':
      return compareValues(value, expected) < 0;
    case 'is':
      return value === expected;
    default:
      return true;
  }
}

function projectRow(row: LocalRow, selection: string): LocalRow {
  if (!selection || selection.trim() === '*') return row;

  const columns = selection
    .split(',')
    .map(column => column.trim())
    .filter(column => column && !column.includes('('));

  if (columns.length === 0) return row;
  return columns.reduce<LocalRow>((projected, column) => {
    const name = column.split('!')[0].trim();
    projected[name] = row[name];
    return projected;
  }, {});
}

function notifyTable(table: string, eventType: string, rows: LocalRow[]): void {
  const payload = { eventType, table, new: rows[0] || null };
  tableListeners.get(table)?.forEach(listener => listener(payload));
}

class LocalQuery implements PromiseLike<LocalResult<DynamicValue>> {
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: LocalRow[] = [];
  private filters: Filter[] = [];
  private orFilters: Filter[][] = [];
  private orders: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = [];
  private selection = '*';
  private returnsRows = false;
  private maxRows: number | null = null;
  private conflictColumns: string[] = [];

  constructor(private readonly table: string) {}

  select(columns = '*'): this {
    this.selection = columns;
    this.returnsRows = true;
    return this;
  }

  insert(values: LocalRow | LocalRow[]): this {
    this.operation = 'insert';
    this.payload = (Array.isArray(values) ? values : [values]).map(value => ({ ...value }));
    return this;
  }

  update(values: LocalRow): this {
    this.operation = 'update';
    this.payload = [{ ...values }];
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  upsert(values: LocalRow | LocalRow[], options?: { onConflict?: string }): this {
    this.operation = 'upsert';
    this.payload = (Array.isArray(values) ? values : [values]).map(value => ({ ...value }));
    this.conflictColumns = (options?.onConflict || 'id').split(',').map(column => column.trim());
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.addFilter(column, 'eq', value);
  }

  neq(column: string, value: unknown): this {
    return this.addFilter(column, 'neq', value);
  }

  in(column: string, values: unknown[]): this {
    return this.addFilter(column, 'in', values);
  }

  ilike(column: string, value: string): this {
    return this.addFilter(column, 'ilike', value);
  }

  gte(column: string, value: unknown): this {
    return this.addFilter(column, 'gte', value);
  }

  lte(column: string, value: unknown): this {
    return this.addFilter(column, 'lte', value);
  }

  gt(column: string, value: unknown): this {
    return this.addFilter(column, 'gt', value);
  }

  lt(column: string, value: unknown): this {
    return this.addFilter(column, 'lt', value);
  }

  is(column: string, value: unknown): this {
    return this.addFilter(column, 'is', value);
  }

  not(column: string, operator: string, value: unknown): this {
    return this.addFilter(column, `not_${operator}`, value);
  }

  or(expression: string): this {
    const alternatives = expression.split(',').map(term => {
      const match = /^([^.]+)\.(eq|neq|ilike)\.(.*)$/.exec(term.trim());
      return match
        ? [{ column: match[1], operator: match[2], value: match[3] }]
        : [];
    }).filter(group => group.length > 0);
    if (alternatives.length) this.orFilters.push(alternatives.flat());
    return this;
  }

  match(values: LocalRow): this {
    Object.entries(values).forEach(([column, value]) => this.eq(column, value));
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orders.push({
      column,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(count: number): this {
    this.maxRows = Math.max(0, count);
    return this;
  }

  async single(): Promise<LocalResult<DynamicValue>> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data || [];
    if (rows.length !== 1) {
      return {
        data: null,
        error: { code: 'PGRST116', message: `Expected one row, received ${rows.length}.` },
      };
    }
    return { data: rows[0], error: null };
  }

  async maybeSingle(): Promise<LocalResult<DynamicValue>> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data || [];
    if (rows.length > 1) {
      return {
        data: null,
        error: { code: 'PGRST116', message: `Expected at most one row, received ${rows.length}.` },
      };
    }
    return { data: rows[0] || null, error: null };
  }

  then<TResult1 = LocalResult<DynamicValue[]>, TResult2 = never>(
    onfulfilled?: ((value: LocalResult<DynamicValue[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private addFilter(column: string, operator: string, value: unknown): this {
    this.filters.push({ column, operator, value });
    return this;
  }

  private async execute(): Promise<LocalResult<DynamicValue[]>> {
    const isMutation = this.operation !== 'select';

    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(TABLE_STORE, isMutation ? 'readwrite' : 'readonly');
        const store = transaction.objectStore(TABLE_STORE);
        const request = store.get(this.table);
        let result: LocalResult<DynamicValue[]> = { data: [], error: null };
        let changedRows: LocalRow[] = [];

        request.onsuccess = () => {
          try {
            const storedRows = Array.isArray(request.result) ? request.result as LocalRow[] : [];
            const matches = (row: LocalRow) => (
              this.filters.every(filter => matchesFilter(row, filter)) &&
              this.orFilters.every(group => group.some(filter => matchesFilter(row, filter)))
            );
            let selected: LocalRow[] = [];

            if (this.operation === 'select') {
              selected = storedRows.filter(matches);
            } else if (this.operation === 'insert') {
              const inserted = this.prepareRows(this.payload);
              const duplicate = inserted.find(row => row.id !== undefined && storedRows.some(existing =>
                String(existing.id) === String(row.id)
              ));
              if (duplicate) throw new Error(`Duplicate id in ${this.table}.`);
              storedRows.push(...inserted);
              changedRows = inserted;
              selected = inserted;
            } else if (this.operation === 'upsert') {
              const upserted: LocalRow[] = [];
              for (const row of this.prepareRows(this.payload)) {
                const existingIndex = storedRows.findIndex(existing =>
                  this.conflictColumns.every(column =>
                    existing[column] != null && row[column] != null &&
                    String(existing[column]) === String(row[column])
                  )
                );
                if (existingIndex === -1) {
                  storedRows.push(row);
                  upserted.push(row);
                } else {
                  storedRows[existingIndex] = { ...storedRows[existingIndex], ...row };
                  upserted.push(storedRows[existingIndex]);
                }
              }
              changedRows = upserted;
              selected = upserted;
            } else if (this.operation === 'update') {
              selected = storedRows.filter(matches);
              selected.forEach(row => Object.assign(row, this.payload[0]));
              changedRows = selected;
            } else {
              const removed = storedRows.filter(matches);
              const kept = storedRows.filter(row => !matches(row));
              storedRows.splice(0, storedRows.length, ...kept);
              changedRows = removed;
              selected = removed;
            }

            if (this.orders.length) {
              selected.sort((left, right) => {
                for (const order of this.orders) {
                  const comparison = compareValues(
                    getValue(left, order.column),
                    getValue(right, order.column),
                  );
                  if (comparison !== 0) {
                    return order.ascending ? comparison : -comparison;
                  }
                }
                return 0;
              });
            }
            if (this.maxRows !== null) selected = selected.slice(0, this.maxRows);

            if (isMutation) store.put(storedRows, this.table);
            const projected = selected.map(row => projectRow({ ...row }, this.selection));
            result = {
              data: isMutation && !this.returnsRows ? null : projected,
              error: null,
            };
          } catch (error) {
            result = { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
            if (isMutation) transaction.abort();
          }
        };

        transaction.oncomplete = () => {
          database.close();
          if (isMutation && changedRows.length) {
            notifyTable(this.table, this.operation, changedRows);
          }
          resolve(result);
        };
        transaction.onerror = () => {
          database.close();
          resolve({
            data: null,
            error: { message: transaction.error?.message || `로컬 ${this.table} 데이터 처리에 실패했습니다.` },
          });
        };
        transaction.onabort = () => {
          database.close();
          if (result.error) resolve(result);
          else resolve({
            data: null,
            error: { message: transaction.error?.message || `로컬 ${this.table} 데이터 처리가 취소되었습니다.` },
          });
        };
      });
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private prepareRows(rows: LocalRow[]): LocalRow[] {
    return rows.map(row => ({
      ...row,
      id: row.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      created_at: row.created_at ?? new Date().toISOString(),
    }));
  }
}

class LocalChannel {
  private subscriptions: Array<{ table: string; listener: (payload: unknown) => void }> = [];

  on(
    _event: string,
    filter: { table?: string; [key: string]: unknown },
    callback: (payload: unknown) => void,
  ): this {
    if (filter.table) {
      const listeners = tableListeners.get(filter.table) || new Set();
      listeners.add(callback);
      tableListeners.set(filter.table, listeners);
      this.subscriptions.push({ table: filter.table, listener: callback });
    }
    return this;
  }

  subscribe(): this {
    return this;
  }

  unsubscribe(): void {
    this.subscriptions.forEach(({ table, listener }) => {
      tableListeners.get(table)?.delete(listener);
    });
    this.subscriptions = [];
  }
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('프로필 사진을 읽지 못했습니다.'));
    };
    reader.onerror = () => reject(reader.error || new Error('프로필 사진을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

export const supabase = {
  from(table: string): LocalQuery {
    return new LocalQuery(table);
  },
  channel(_name?: string): LocalChannel {
    void _name;
    return new LocalChannel();
  },
  removeChannel(channel: LocalChannel): void {
    channel.unsubscribe();
  },
  auth: {
    async getUser() {
      return {
        data: { user: null as { id: string; email?: string } | null },
        error: null,
      };
    },
    async signOut() {
      return { error: null };
    },
  },
  storage: {
    from(bucket: string) {
      return {
        async upload(
          path: string,
          file: File,
          _options?: { cacheControl?: string; upsert?: boolean; contentType?: string },
        ) {
          void _options;
          try {
            photoUrls.set(`${bucket}/${path}`, await readFileAsDataUrl(file));
            return { data: { path }, error: null };
          } catch (error) {
            return {
              data: null,
              error: { message: error instanceof Error ? error.message : String(error) },
            };
          }
        },
        getPublicUrl(path: string) {
          return {
            data: {
              publicUrl: photoUrls.get(`${bucket}/${path}`) || '',
            },
          };
        },
      };
    },
  },
  async rpc(functionName: string, args: LocalRow): Promise<LocalResult<DynamicValue>> {
    if (functionName !== 'return_inventory_batch') {
      return { data: null, error: { message: `지원하지 않는 로컬 함수입니다: ${functionName}` } };
    }

    try {
      const { data: batchItems, error: batchError } = await new LocalQuery('inventory_batch_items')
        .select('*')
        .eq('batch_id', args.p_batch_id)
        .eq('status', 'ISSUED');
      if (batchError) throw new Error(batchError.message);

      const returnedAt = new Date().toISOString();
      let returnedCount = 0;

      for (const item of batchItems || []) {
        if (item.inventory_id != null && item.inventory_type !== 'CABIN') {
          const table = item.inventory_type === 'CABIN' ? 'cabin_inventory' : 'inventory';
          const { data: inventoryItem, error: inventoryError } = await new LocalQuery(table)
            .select('id, quantity')
            .eq('id', item.inventory_id)
            .maybeSingle();
          if (inventoryError) throw new Error(inventoryError.message);
          if (inventoryItem) {
            const { error } = await new LocalQuery(table)
              .update({ quantity: Number(inventoryItem.quantity || 0) + Number(item.quantity || 0) })
              .eq('id', item.inventory_id);
            if (error) throw new Error(error.message);
          }
        }

        const { error: batchUpdateError } = await new LocalQuery('inventory_batch_items')
          .update({
            status: 'RETURNED',
            returned_by: args.p_returned_by,
            returned_at: returnedAt,
          })
          .eq('id', item.id);
        if (batchUpdateError) throw new Error(batchUpdateError.message);

        const { error: historyError } = await new LocalQuery('inventory_return_history')
          .insert({
            inventory_id: item.inventory_id ?? null,
            item_code: item.item_code ?? null,
            item_name: item.item_name ?? null,
            quantity: Number(item.quantity || 0),
            issued_by: item.issued_by || '불출자 미기록',
            returned_by: args.p_returned_by || '작업자',
            issued_at: item.issued_at ?? null,
            returned_at: returnedAt,
            memo: args.p_memo || (args.p_has_issue ? '이상 있음' : null),
          });
        if (historyError) throw new Error(historyError.message);
        returnedCount += 1;
      }

      const { error: logError } = await new LocalQuery('inventory_logs')
        .update({
          type: '반납완료',
          returned_by: args.p_returned_by,
          updated_at: returnedAt,
        })
        .eq('batch_id', args.p_batch_id);
      if (logError) throw new Error(logError.message);

      return { data: { returned_count: returnedCount }, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  },
};
