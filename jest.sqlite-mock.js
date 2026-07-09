// Mock in-memory de expo-sqlite para jest (T068.5).
// Implementa subset da API usada por OutboxService.

class MockStatement {
  constructor(sql, db) {
    this.sql = sql.trim();
    this.db = db;
    this.params = [];
  }

  executeAsync(params = []) {
    this.params = params;
    return this.db.execute(this.sql, this.params);
  }

  finalizeAsync() {
    return Promise.resolve();
  }
}

function normalizeBindParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

class MockDatabase {
  constructor() {
    this.tables = new Map();
    this.nextId = 1;
  }

  execAsync(source) {
    for (const raw of source.split(';')) {
      const stmt = raw.trim();
      if (!stmt) continue;
      const upper = stmt.toUpperCase();
      if (upper.startsWith('CREATE TABLE')) {
        const match = stmt.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
        if (match && !this.tables.has(match[1])) {
          this.tables.set(match[1], []);
        }
      } else if (upper.startsWith('ALTER TABLE')) {
        // T100: ALTER TABLE outbox ADD COLUMN idempotency_key TEXT
        const m = stmt.match(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/i);
        if (m) {
          const table = this.tables.get(m[1]);
          if (table && table.rows.length > 0 && !(m[2] in table.rows[0])) {
            for (const row of table.rows) row[m[2]] = null;
          }
        }
      } else if (upper.startsWith('PRAGMA')) {
        // No-op (incluindo PRAGMA user_version — não persistido entre testes)
      }
    }
    return Promise.resolve();
  }

  prepareAsync(source) {
    return Promise.resolve(new MockStatement(source, this));
  }

  /**
   * T100: helper para `PRAGMA user_version` etc. Retorna a primeira linha
   * do SELECT (ou null se vazio). Usado por OutboxService.init para
   * detectar migrations pendentes.
   */
  getFirstAsync(source, ...params) {
    const bindParams = normalizeBindParams(params);
    const stmt = new MockStatement(source, this);
    return stmt.executeAsync(bindParams).then((res) => res.getFirstAsync());
  }

  runAsync(source, ...params) {
    const bindParams = normalizeBindParams(params);
    return this.execute(source, bindParams).then(() => undefined);
  }

  getAllAsync(source, ...params) {
    const bindParams = normalizeBindParams(params);
    const stmt = new MockStatement(source, this);
    return stmt.executeAsync(bindParams).then((res) => res.getAllAsync());
  }

  closeAsync() {
    this.tables.clear();
    this.nextId = 1;
    return Promise.resolve();
  }

  async execute(sql, params) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const upper = normalized.toUpperCase();
    if (upper.startsWith('INSERT')) {
      return this.execInsert(normalized, params);
    }
    if (upper.startsWith('UPDATE')) {
      return this.execUpdate(sql, params);
    }
    if (upper.startsWith('DELETE FROM')) {
      return this.execDelete(sql, params);
    }
    if (upper.startsWith('SELECT COUNT')) {
      return this.execSelectCount(sql, params);
    }
    if (upper.startsWith('SELECT')) {
      return this.execSelect(sql, params);
    }
    if (upper.startsWith('PRAGMA')) {
      // T100: PRAGMA user_version sempre retorna 0 (reset entre testes).
      return {
        lastInsertRowId: 0,
        changes: 0,
        getAllAsync: async () => [{ user_version: 0 }],
        getFirstAsync: async () => ({ user_version: 0 }),
      };
    }
    throw new Error(`SQL not supported by mock: ${sql}`);
  }

  execInsert(sql, params) {
    const tableName = sql.match(/INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+(\w+)/i)[1];
    const rows = this.tables.get(tableName) || [];
    const row = {};
    const columnsMatch = sql.match(/INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+\w+\s*\(([^)]+)\)/i);
    const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
    if (columnsMatch && valuesMatch) {
      const columns = columnsMatch[1].split(',').map((c) => c.trim());
      const valueTokens = valuesMatch[1].split(',').map((t) => t.trim());
      let paramIdx = 0;
      columns.forEach((col, idx) => {
        const token = valueTokens[idx];
        if (token === '?') {
          const val = params[paramIdx++];
          row[col] = typeof val === 'string' || typeof val === 'number'
            ? val
            : val === null
              ? null
              : String(val);
        } else if (token === 'NULL') {
          row[col] = null;
        } else if (/^\d+$/.test(token)) {
          row[col] = parseInt(token, 10);
        } else {
          row[col] = null;
        }
      });
    }

    const isReplace = /INSERT\s+OR\s+REPLACE/i.test(sql);
    if (isReplace && row.id !== undefined) {
      const existingIdx = rows.findIndex((r) => r.id === row.id);
      if (existingIdx >= 0) {
        rows[existingIdx] = { ...rows[existingIdx], ...row };
        this.tables.set(tableName, rows);
        return {
          lastInsertRowId: row.id,
          changes: 1,
          getAllAsync: async () => rows,
        };
      }
    }

    const id = row.id ?? this.nextId++;
    row.id = id;
    rows.push(row);
    this.tables.set(tableName, rows);
    return {
      lastInsertRowId: id,
      changes: 1,
      getAllAsync: async () => rows,
    };
  }

  execUpdate(sql, params) {
    const tableName = sql.match(/UPDATE\s+(\w+)/i)[1];
    const rows = this.tables.get(tableName) || [];
    // Parse SET clause com indexOf (evita regex lazy + Babel)
    const sqlUpper = sql.toUpperCase();
    const setIdx = sqlUpper.indexOf('SET ');
    const whereIdx = sqlUpper.indexOf(' WHERE ');
    const setClause = (setIdx >= 0 && whereIdx > setIdx)
      ? sql.substring(setIdx + 4, whereIdx).trim()
      : '';
    const whereClause = (whereIdx >= 0)
      ? sql.substring(whereIdx + 7).trim()
      : '';
    const setItems = parseAssignments(setClause);
    const whereConditions = parseConditions(whereClause);
    // WHERE params: vem DEPOIS dos SET params. Conta apenas assignments
    // que consomem param (? placeholders) — literals e modifier (increment)
    // não consomem.
    const setParamCount = setItems.filter((a) => a.paramIndex !== undefined).length;
    const whereParams = params.slice(setParamCount);
    let changes = 0;
    for (const row of rows) {
      if (matchesConditions(row, whereConditions, whereParams)) {
        applyAssignments(row, setItems, params);
        changes++;
      }
    }
    return {
      lastInsertRowId: 0,
      changes,
      getAllAsync: async () => rows,
    };
  }

  execDelete(sql, params) {
    const tableName = sql.match(/DELETE FROM\s+(\w+)/i)[1];
    const rows = this.tables.get(tableName) || [];
    const sqlUpper = sql.toUpperCase();
    const whereIdx = sqlUpper.indexOf(' WHERE ');
    const whereClause = (whereIdx >= 0) ? sql.substring(whereIdx + 7).trim() : '';
    const whereConditions = parseConditions(whereClause);
    const matching = rows.filter((row) => matchesConditions(row, whereConditions, params));
    const newRows = rows.filter((row) => !matchesConditions(row, whereConditions, params));
    this.tables.set(tableName, newRows);
    return {
      lastInsertRowId: 0,
      changes: matching.length,
      getAllAsync: async () => newRows,
    };
  }

  execSelectCount(sql, params) {
    const tableName = sql.match(/FROM\s+(\w+)/i)[1];
    const rows = this.tables.get(tableName) || [];
    // Apply WHERE filter (same logic as execSelect)
    const sqlUpper = sql.toUpperCase();
    const whereIdx = sqlUpper.indexOf(' WHERE ');
    let whereClause = '';
    if (whereIdx >= 0) {
      whereClause = sql.substring(whereIdx + 7).trim();
    }
    const whereConditions = parseConditions(whereClause);
    const filtered = rows.filter((row) => matchesConditions(row, whereConditions, params || []));
    return {
      lastInsertRowId: 0,
      changes: 0,
      getAllAsync: async () => [{ c: filtered.length }],
      getFirstAsync: async () => filtered.length,
    };
  }

  execSelect(sql, params) {
    const tableName = sql.match(/FROM\s+(\w+)/i)[1];
    const rows = this.tables.get(tableName) || [];
    const sqlUpper = sql.toUpperCase();
    const whereIdx = sqlUpper.indexOf(' WHERE ');
    const orderByIdx = sqlUpper.indexOf(' ORDER BY ');
    const limitIdx = sqlUpper.indexOf(' LIMIT ');
    let whereClause = '';
    if (whereIdx >= 0) {
      const endCandidates = [orderByIdx, limitIdx, sql.length].filter(
        (idx) => idx > whereIdx,
      );
      const end = endCandidates.length > 0 ? Math.min(...endCandidates) : sql.length;
      whereClause = sql.substring(whereIdx + 7, end).trim();
    }
    const whereConditions = parseConditions(whereClause);
    let result = rows.filter((row) => matchesConditions(row, whereConditions, params));
    if (orderByIdx >= 0) {
      const orderClause = sql.substring(orderByIdx + 10).trim();
      const orderByMatch = orderClause.match(/^(\w+)(?:\s+(ASC|DESC))?/i);
      if (orderByMatch) {
        const col = orderByMatch[1];
        const dir = (orderByMatch[2] || 'ASC').toUpperCase();
        result = [...result].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (av === bv) return 0;
          const cmp = av < bv ? -1 : 1;
          return dir === 'DESC' ? -cmp : cmp;
        });
      }
    }
    if (limitIdx >= 0) {
      const limitMatch = sql.substring(limitIdx).match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        result = result.slice(0, parseInt(limitMatch[1], 10));
      }
    }
    return {
      lastInsertRowId: 0,
      changes: 0,
      getAllAsync: async () => result,
      getFirstAsync: async () => result[0] ?? null,
    };
  }
}

function parseAssignments(clause) {
  return clause.split(',').map((c) => {
    const trimmed = c.trim();
    const incMatch = trimmed.match(/^(\w+)\s*=\s*\1\s*\+\s*1$/);
    if (incMatch) {
      return { column: incMatch[1], modifier: 'increment' };
    }
    const decMatch = trimmed.match(/^(\w+)\s*=\s*\1\s*-\s*1$/);
    if (decMatch) {
      return { column: decMatch[1], modifier: 'decrement' };
    }
    const eqMatch = trimmed.match(/^(\w+)\s*=\s*\?$/);
    if (eqMatch) {
      return { column: eqMatch[1], paramIndex: 0 };
    }
    // Literal value: column = 0, column = NULL, column = 'foo'
    const literalMatch = trimmed.match(/^(\w+)\s*=\s*(NULL|(-?\d+(?:\.\d+)?)|'([^']*)')$/i);
    if (literalMatch) {
      const column = literalMatch[1];
      let literalValue = null;
      if (literalMatch[2] === 'NULL') {
        literalValue = null;
      } else if (literalMatch[3] !== undefined) {
        literalValue = Number(literalMatch[3]);
      } else if (literalMatch[4] !== undefined) {
        literalValue = literalMatch[4];
      }
      return { column, literal: literalValue };
    }
    throw new Error(`Unsupported assignment: [${c}]`);
  });
}

function parseConditions(clause) {
  if (!clause) return [];
  return clause.split(/\s+AND\s+/i).map((c) => {
    const match = c.trim().match(/(\w+)\s*(<=|>=|<>|!=|<|>|=)\s*\?/);
    if (match) {
      return { column: match[1], operator: match[2], paramIndex: 0 };
    }
    // Literal comparison: column = 0, column = 'foo'
    const literalMatch = c.trim().match(/(\w+)\s*(<=|>=|<>|!=|<|>|=)\s*(NULL|(-?\d+(?:\.\d+)?)|'([^']*)')$/i);
    if (literalMatch) {
      const column = literalMatch[1];
      const operator = literalMatch[2];
      let literalValue = null;
      if (literalMatch[3] === 'NULL') literalValue = null;
      else if (literalMatch[4] !== undefined) literalValue = Number(literalMatch[4]);
      else if (literalMatch[5] !== undefined) literalValue = literalMatch[5];
      return { column, operator, literal: literalValue };
    }
    throw new Error(`Unsupported condition: ${c}`);
  });
}

function matchesConditions(row, conditions, params) {
  let paramIdx = 0;
  return conditions.every((cond) => {
    const val = cond.literal !== undefined ? cond.literal : params[paramIdx++];
    const cell = row[cond.column];
    switch (cond.operator) {
      case '=':
        return cell === val;
      case '<=':
        return cell <= val;
      case '<':
        return cell < val;
      case '>=':
        return cell >= val;
      case '>':
        return cell > val;
      case '!=':
      case '<>':
        return cell !== val;
      default:
        return false;
    }
  });
}

function applyAssignments(row, assignments, params) {
  let paramIdx = 0;
  for (const a of assignments) {
    if (a.modifier === 'increment') {
      row[a.column] = row[a.column] + 1;
    } else if (a.modifier === 'decrement') {
      row[a.column] = row[a.column] - 1;
    } else if (a.literal !== undefined) {
      row[a.column] = a.literal;
    } else if (a.paramIndex !== undefined) {
      row[a.column] = params[paramIdx++];
    }
  }
}

let dbInstance = null;
let dbCallCount = 0;

function openDatabaseAsync() {
  dbCallCount++;
  if (!dbInstance) {
    dbInstance = new MockDatabase();
  }
  return Promise.resolve(dbInstance);
}

function __resetMockDb() {
  if (dbInstance) {
    dbInstance.closeAsync();
  }
  dbInstance = null;
  dbCallCount = 0;
}

function __getDbCallCount() {
  return dbCallCount;
}

module.exports = { openDatabaseAsync, __resetMockDb, __getDbCallCount };
