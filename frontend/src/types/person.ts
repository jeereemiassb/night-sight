export interface DirectoryFieldDefinition {
  key: string;
  label: string;
  defaultVisible: boolean;
  icon?: string | null;
}

export interface UiConfig {
  personIdLabel: string;
  searchMinLength: number;
  maxResults: number;
  fields: DirectoryFieldDefinition[];
}

export interface PersonSummary {
  id: string;
  personId: string | null;
  displayName: string;
  similarity?: number;
}

export interface PersonRecord extends PersonSummary {
  fields: Record<string, string | null>;
  photo: string | null;
  hasPhoto: boolean;
}

export interface RecognitionCandidate {
  personId: string | null;
  displayName: string;
  similarity: number;
  similarityPercent: number;
}

export interface RecognitionResult {
  recognized: boolean;
  displayName: string | null;
  personId: string | null;
  threshold: number;
  faceCount: number;
  bestMatch: RecognitionCandidate | null;
  topMatches: RecognitionCandidate[];
  reason: string | null;
}
