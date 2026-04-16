export type LocalSchema = {
  files: {
    id: string;
    name: string;
    parent_id: string | null;
    is_root?: boolean;
    next_id: string | null;
    prev_id: string | null;
    created_at: string;
    updated_at: string;
  },
  statements: {
    id: string;
    name: string;
    file_id: string;
    next_id: string | null;
    prev_id: string | null;
    size: number;
    type: "definition" | "theorem" | "proposition";
    content: {
      content: string;
      proof: string | null;
    }
    created_at: string;
    updated_at: string;
  },
  operations: {
    id: string;
    entity: string;
    op_type: 'insert' | 'update' | 'delete';
    payload?: any;
    client_id?: string | null;
    client_op_id?: string | null;
    created_at: number;
    sent_at?: number | null;
    processed?: boolean;
    attempts?: number;
    last_error?: string | null;
    undone?: boolean;
    meta?: any;
  }
}

export type Store = keyof LocalSchema;

export const Stores = ['files', 'statements', 'operations'];
