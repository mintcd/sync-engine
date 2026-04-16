export type RemoteSchema = {
  files: {
    id: string;
    name: string;
    parent_id: string | null;
    next_id: string | null;
    prev_id: string | null;
    created_at: string | number;
    updated_at: string | number;
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
}