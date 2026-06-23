export interface Node {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  formula?: string | null;
  example?: string | null;
  verbal_formula?: string | null;
  nominal_formula?: string | null;
  pos_form?: string | null;
  neg_form?: string | null;
  int_form?: string | null;
  time_signals?: string | null;
  usage_context?: string | null;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
}

export interface Edge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      nodes: {
        Row: Node;
        Insert: Omit<Node, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<Node, 'id'>>;
      };
      edges: {
        Row: Edge;
        Insert: Omit<Edge, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Edge, 'id'>>;
      };
      user_roles: {
        Row: UserRole;
        Insert: Omit<UserRole, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<UserRole, 'id'>>;
      };
    };
  };
}
