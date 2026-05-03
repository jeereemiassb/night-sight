import type {
  DirectoryFieldDefinition,
  PersonRecord,
  RecognitionCandidate,
  RecognitionResult,
  UiConfig,
} from "@/types/person";
import { dictionary } from "@/config/dictionary";

interface SearchApiPerson {
  id: string;
  person_id: string | null;
  display_name: string | null;
  fields: Record<string, string | null>;
  has_photo: boolean;
  photo_data_url: string | null;
}

interface SearchPeopleResponse {
  count: number;
  results: SearchApiPerson[];
}

interface PersonDetailResponse {
  person: SearchApiPerson;
}

interface UiConfigFieldResponse {
  key: string;
  label: string;
  default_visible: boolean;
  icon?: string | null;
}

interface UiConfigResponse {
  person_id_label: string;
  search_min_length: number;
  max_results: number;
  fields: UiConfigFieldResponse[];
}

interface RecognitionApiCandidate {
  person_id: string | null;
  display_name: string;
  similarity: number;
  similarity_percent: number;
}

interface RecognitionApiResponse {
  recognized: boolean;
  display_name: string | null;
  person_id: string | null;
  threshold: number;
  face_count: number;
  best_match: RecognitionApiCandidate | null;
  top_matches: RecognitionApiCandidate[];
  reason: string | null;
}

interface HealthResponse {
  stats?: {
    db_rows?: number | null;
  };
}

function toFieldDefinition(field: UiConfigFieldResponse): DirectoryFieldDefinition {
  return {
    key: field.key,
    label: field.label,
    defaultVisible: field.default_visible,
    icon: field.icon,
  };
}

function toPersonRecord(person: SearchApiPerson): PersonRecord {
  return {
    id: person.id,
    personId: person.person_id,
    displayName: person.display_name ?? dictionary.person.unknownDisplayName,
    fields: person.fields ?? {},
    photo: person.photo_data_url,
    hasPhoto: person.has_photo,
  };
}

function toRecognitionCandidate(candidate: RecognitionApiCandidate): RecognitionCandidate {
  return {
    personId: candidate.person_id,
    displayName: candidate.display_name,
    similarity: candidate.similarity,
    similarityPercent: candidate.similarity_percent,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = dictionary.errors.requestFailed(response.status);
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {}
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function fetchUiConfig(): Promise<UiConfig> {
  const response = await fetch("/api/ui-config");
  const payload = await parseResponse<UiConfigResponse>(response);
  return {
    personIdLabel: payload.person_id_label,
    searchMinLength: payload.search_min_length,
    maxResults: payload.max_results,
    fields: payload.fields.map(toFieldDefinition),
  };
}

export async function fetchRecordsCount(): Promise<number | null> {
  const response = await fetch("/api/health");
  const payload = await parseResponse<HealthResponse>(response);
  return payload.stats?.db_rows ?? null;
}

export async function searchPeople(params: {
  query?: string;
  personId?: string;
  includePhoto?: boolean;
  limit?: number;
}): Promise<PersonRecord[]> {
  const searchParams = new URLSearchParams();

  if (params.query) {
    searchParams.set("q", params.query);
  }

  if (params.personId) {
    searchParams.set("person_id", params.personId);
  }

  searchParams.set("include_photo", String(params.includePhoto ?? true));

  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const response = await fetch(`/api/people/search?${searchParams.toString()}`);
  const payload = await parseResponse<SearchPeopleResponse>(response);
  return payload.results.map(toPersonRecord);
}

export async function fetchPersonDetail(personId: string, includePhoto = true): Promise<PersonRecord> {
  const searchParams = new URLSearchParams();
  searchParams.set("include_photo", String(includePhoto));

  const response = await fetch(`/api/people/${encodeURIComponent(personId)}?${searchParams.toString()}`);
  const payload = await parseResponse<PersonDetailResponse>(response);
  return toPersonRecord(payload.person);
}

export async function recognizeImage(payload: {
  imageBase64: string;
  threshold?: number;
  topK?: number;
}): Promise<RecognitionResult> {
  const response = await fetch("/api/recognition/identify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_base64: payload.imageBase64,
      threshold: payload.threshold,
      top_k: payload.topK,
    }),
  });

  const data = await parseResponse<RecognitionApiResponse>(response);

  return {
    recognized: data.recognized,
    displayName: data.display_name,
    personId: data.person_id,
    threshold: data.threshold,
    faceCount: data.face_count,
    bestMatch: data.best_match ? toRecognitionCandidate(data.best_match) : null,
    topMatches: data.top_matches.map(toRecognitionCandidate),
    reason: data.reason,
  };
}
