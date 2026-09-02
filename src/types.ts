export interface DBColumn {
  name: string;
  type: string;
  isPK: boolean;
  isFK: boolean;
  fkRef?: string;
  constraints?: string[];
  description: string;
}

export interface DBIndex {
  name: string;
  columns: string[];
  type: string;
  reason: string;
}

export interface DBTable {
  id: string;
  name: string;
  purpose: string;
  realWorldUsage: string;
  columns: DBColumn[];
  indexes: DBIndex[];
  sqlDDL: string;
}

export interface ERDConnection {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: '1-to-many' | '1-to-1' | 'many-to-many';
}

export interface NormanLevel {
  title: string;
  concept: string;
  appliedExample: {
    beforeText: string;
    beforeTable: {
      headers: string[];
      rows: string[][];
    };
    afterText: string;
    afterTables: {
      name: string;
      headers: string[];
      rows: string[][];
    }[];
    problemsSolved: string[];
  };
}

export interface QuizQuestion {
  id: number;
  question: string;
  category: 'Indexing & Performance' | 'Normalization' | 'Schema Modeling' | 'Triggers & Constraints' | 'Concurrency & Isolation';
  options: string[];
  correctAnswerIndex: number;
  explanation: {
    overview: string;
    architectOpinion: string;
  };
}

export interface SimulationQuery {
  id: string;
  title: string;
  description: string;
  sqlQuery: string;
  explanation: string;
  indexTarget: string;
  mockResult: Record<string, string | number | boolean>[];
}
