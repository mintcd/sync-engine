export type SelectAST = { action: 'SELECT'; table: string; select?: string[]; where?: any; };
export type InsertAST = { action: 'INSERT'; table: string; insert: { [field: string]: any } | { [field: string]: any }[]; };
export type UpdateAST = { action: 'UPDATE'; table: string; update: { [field: string]: any } | { [field: string]: any }[]; where?: any; };
export type DeleteAST = { action: 'DELETE'; table: string; where?: any; };
export type QueryAST = SelectAST | InsertAST | UpdateAST | DeleteAST;

export type ConditionNode = { operator: string; field?: string; value?: any; where?: ConditionNode[]; };

// Helper to extract keys of T
export type Keys<T> = keyof T & string;

// Extend PromiseLike so TypeScript knows these can be awaited directly
export interface IWhere<T = any> extends PromiseLike<T[]> {
  execute(): Promise<T[]>;
}

export interface IFrom<Schema, TTable extends keyof Schema> extends PromiseLike<Schema[TTable][]> {
  where(condition: ConditionNode): IWhere<Schema[TTable]>;
  execute(): Promise<Schema[TTable][]>;
}

export interface ITable<Schema> {
  from<TTable extends keyof Schema>(table: TTable): IFrom<Schema, TTable>;
}

export interface IDatabase<Schema> {
  select(...fields: string[]): ITable<Schema>;
  insert(data: any): ITable<Schema>;
  update(data: any): ITable<Schema>;
  delete(): ITable<Schema>;
}


export class QueryBuilder<Schema = any> implements IDatabase<Schema>, ITable<Schema>, IFrom<Schema, any> {
  ast: any = {};

  // Accept the executor in the constructor
  constructor(private executor?: (ast: QueryAST) => Promise<any>) { }

  select(...props: string[]): ITable<Schema> {
    this.ast.action = 'SELECT';
    this.ast.select = props;
    return this;
  }

  insert(data: { [field: string]: any } | { [field: string]: any }[]): ITable<Schema> {
    this.ast.action = 'INSERT';
    this.ast.insert = data;
    return this;
  }

  update(data: { [field: string]: any } | { [field: string]: any }[]): ITable<Schema> {
    this.ast.action = 'UPDATE';
    this.ast.update = data;
    return this;
  }

  delete(): ITable<Schema> {
    this.ast.action = 'DELETE';
    return this;
  }

  from<TTable extends keyof Schema>(table: TTable): IFrom<Schema, TTable> {
    this.ast.table = table as string;
    return this;
  }

  where(condition: ConditionNode): IWhere<any> {
    this.ast.where = condition;
    return this;
  }

  async execute(): Promise<any> {
    if (this.executor) return this.executor(this.ast);
    console.log("Executing:", this.ast);
    return [];
  }

  async then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// Standalone operators
export const eq = (field: string, value: any): ConditionNode => ({ operator: '=', field, value });
export const gt = (field: string, value: number): ConditionNode => ({ operator: '>', field, value });
export const and = (...where: ConditionNode[]): ConditionNode => ({ operator: 'AND', where });
export const or = (...where: ConditionNode[]): ConditionNode => ({ operator: 'OR', where });

export function createQueryBuilder<Schema>(execute: (ast: QueryAST) => Promise<any>): IDatabase<Schema> {
  return {
    select(...fields: string[]) { return new QueryBuilder<Schema>(execute).select(...fields); },
    insert(data: any) { return new QueryBuilder<Schema>(execute).insert(data); },
    update(data: any) { return new QueryBuilder<Schema>(execute).update(data); },
    delete() { return new QueryBuilder<Schema>(execute).delete(); }
  };
}
