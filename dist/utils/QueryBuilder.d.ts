export type SelectAST = {
    action: 'SELECT';
    table: string;
    select?: string[];
    where?: any;
};
export type InsertAST = {
    action: 'INSERT';
    table: string;
    insert: {
        [field: string]: any;
    } | {
        [field: string]: any;
    }[];
};
export type UpdateAST = {
    action: 'UPDATE';
    table: string;
    update: {
        [field: string]: any;
    } | {
        [field: string]: any;
    }[];
    where?: any;
};
export type DeleteAST = {
    action: 'DELETE';
    table: string;
    where?: any;
};
export type QueryAST = SelectAST | InsertAST | UpdateAST | DeleteAST;
export type ConditionNode = {
    operator: string;
    field?: string;
    value?: any;
    where?: ConditionNode[];
};
export type Keys<T> = keyof T & string;
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
export declare class QueryBuilder<Schema = any> implements IDatabase<Schema>, ITable<Schema>, IFrom<Schema, any> {
    private executor?;
    ast: any;
    constructor(executor?: (ast: QueryAST) => Promise<any>);
    select(...props: string[]): ITable<Schema>;
    insert(data: {
        [field: string]: any;
    } | {
        [field: string]: any;
    }[]): ITable<Schema>;
    update(data: {
        [field: string]: any;
    } | {
        [field: string]: any;
    }[]): ITable<Schema>;
    delete(): ITable<Schema>;
    from<TTable extends keyof Schema>(table: TTable): IFrom<Schema, TTable>;
    where(condition: ConditionNode): IWhere<any>;
    execute(): Promise<any>;
    then<TResult1 = any, TResult2 = never>(onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
}
export declare const eq: (field: string, value: any) => ConditionNode;
export declare const gt: (field: string, value: number) => ConditionNode;
export declare const and: (...where: ConditionNode[]) => ConditionNode;
export declare const or: (...where: ConditionNode[]) => ConditionNode;
export declare function createQueryBuilder<Schema>(execute: (ast: QueryAST) => Promise<any>): IDatabase<Schema>;
