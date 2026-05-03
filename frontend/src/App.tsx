import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Database, Loader2, Shield, Terminal } from "lucide-react";
import { DataFieldSelector } from "@/components/DataFieldSelector";
import { ImageDropZone } from "@/components/ImageDropZone";
import { PersonDetails } from "@/components/PersonDetails";
import { SearchBar } from "@/components/SearchBar";
import { SimilarMatchesList } from "@/components/SimilarMatchesList";
import { dictionary } from "@/config/dictionary";
import { fetchPersonDetail, fetchRecordsCount, fetchUiConfig, recognizeImage, searchPeople } from "@/lib/api";
import type { PersonRecord, UiConfig } from "@/types/person";

const fallbackUiConfig: UiConfig = {
  personIdLabel: dictionary.fallbackUiConfig.personIdLabel,
  searchMinLength: 3,
  maxResults: 25,
  fields: [],
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return dictionary.errors.unexpectedBackendError;
}

function createPendingPerson(params: {
  displayName: string;
  personId: string | null;
  similarity?: number;
  photo?: string | null;
}): PersonRecord {
  return {
    id: params.personId ?? params.displayName,
    personId: params.personId,
    displayName: params.displayName,
    fields: {},
    photo: params.photo ?? null,
    hasPhoto: !!params.photo,
    similarity: params.similarity,
  };
}

function mergePersonDetail(base: PersonRecord, detail: PersonRecord): PersonRecord {
  return {
    ...base,
    ...detail,
    fields: {
      ...base.fields,
      ...detail.fields,
    },
    photo: detail.photo ?? base.photo,
    hasPhoto: detail.hasPhoto || base.hasPhoto,
    similarity: base.similarity ?? detail.similarity,
  };
}

function App() {
  const [isRecognizingImage, setIsRecognizingImage] = useState(false);
  const [isSearchingByName, setIsSearchingByName] = useState(false);
  const [isLoadingProfileAfterRecognition, setIsLoadingProfileAfterRecognition] = useState(false);
  const [isLoadingSelectedPerson, setIsLoadingSelectedPerson] = useState(false);

  const [uiConfig, setUiConfig] = useState<UiConfig | null>(null);
  const [searchResults, setSearchResults] = useState<PersonRecord[] | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [recordsCount, setRecordsCount] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const selectedPersonRequestId = useRef(0);

  const resolvedUiConfig = uiConfig ?? fallbackUiConfig;
  const fieldDefinitions = resolvedUiConfig.fields;

  useEffect(() => {
    document.title = dictionary.app.documentTitle;
    document.documentElement.lang = dictionary.locale.split("-")[0] ?? dictionary.locale;
  }, []);

  useEffect(() => {
    let active = true;

    fetchUiConfig()
      .then((config) => {
        if (!active) {
          return;
        }

        setUiConfig(config);

        const defaultVisible = config.fields.filter((field) => field.defaultVisible).map((field) => field.key);
        setSelectedFields(defaultVisible.length > 0 ? defaultVisible : config.fields.slice(0, 4).map((field) => field.key));
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setUiConfig(fallbackUiConfig);
        setStatusMessage(getErrorMessage(error));
      });

    fetchRecordsCount()
      .then((count) => {
        if (active) {
          setRecordsCount(count);
        }
      })
      .catch(() => {
        if (active) {
          setRecordsCount(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const loadPersonDetail = useCallback(async (person: PersonRecord): Promise<PersonRecord> => {
    if (!person.personId) {
      setSelectedPerson(person);
      return person;
    }

    const requestId = selectedPersonRequestId.current + 1;
    selectedPersonRequestId.current = requestId;

    setSelectedPerson(person);
    setIsLoadingSelectedPerson(true);

    try {
      const detail = await fetchPersonDetail(person.personId, true);

      setSearchResults((prev) =>
        prev?.map((entry) => (entry.id === person.id ? mergePersonDetail(entry, detail) : entry)) ?? prev,
      );

      const enriched = mergePersonDetail(person, detail);
      if (selectedPersonRequestId.current === requestId) {
        setSelectedPerson(enriched);
      }

      return enriched;
    } finally {
      if (selectedPersonRequestId.current === requestId) {
        setIsLoadingSelectedPerson(false);
      }
    }
  }, []);

  const handleNameSearch = useCallback(async (name: string) => {
    const normalizedName = name.trim();

    if (normalizedName.length < resolvedUiConfig.searchMinLength) {
      setStatusMessage(dictionary.search.minLengthMessage(resolvedUiConfig.searchMinLength));
      return;
    }

    setIsSearchingByName(true);
    selectedPersonRequestId.current += 1;
    setIsLoadingSelectedPerson(false);
    setStatusMessage(dictionary.status.searchingByName);

    try {
      const results = await searchPeople({
        query: normalizedName,
        includePhoto: false,
        limit: resolvedUiConfig.maxResults,
      });
      setSearchResults(results);
      const firstResult = results[0] ?? null;
      setSelectedPerson(firstResult);

      if (firstResult?.personId) {
        void loadPersonDetail(firstResult).catch(() => {
          setStatusMessage(dictionary.status.fullProfileFailed);
        });
      }

      setStatusMessage(results.length === 0 ? dictionary.status.noMatchesByName : dictionary.status.foundCount(results.length));
    } catch (error) {
      setSearchResults([]);
      setSelectedPerson(null);
      setStatusMessage(getErrorMessage(error));
    } finally {
      setIsSearchingByName(false);
    }
  }, [loadPersonDetail, resolvedUiConfig.maxResults, resolvedUiConfig.searchMinLength]);

  const handleImageSearch = useCallback(async (imageBase64: string) => {
    setIsRecognizingImage(true);
    selectedPersonRequestId.current += 1;
    setIsLoadingSelectedPerson(false);
    setStatusMessage(dictionary.status.analyzingImage);

    try {
      const recognition = await recognizeImage({ imageBase64 });
      const primaryDisplayName =
        recognition.displayName ?? recognition.bestMatch?.displayName ?? recognition.topMatches[0]?.displayName;
      const primaryPersonId =
        recognition.personId ?? recognition.bestMatch?.personId ?? recognition.topMatches[0]?.personId ?? null;

      if (!primaryDisplayName) {
        setSearchResults([]);
        setSelectedPerson(null);
        setStatusMessage(dictionary.status.noValidFaceMatch);
        return;
      }

      const candidates = recognition.topMatches.length > 0
        ? recognition.topMatches
        : recognition.bestMatch
          ? [recognition.bestMatch]
          : [
              {
                displayName: primaryDisplayName,
                personId: primaryPersonId,
                similarity: 0,
                similarityPercent: recognition.bestMatch?.similarityPercent,
              },
            ];

      const pendingCandidates = candidates.map((candidate, index) =>
        createPendingPerson({
          displayName: candidate.displayName,
          personId: candidate.personId,
          similarity: candidate.similarityPercent,
          photo: recognition.recognized && index === 0 ? imageBase64 : null,
        }),
      );

      setSearchResults(pendingCandidates);
      setSelectedPerson(pendingCandidates[0] ?? null);
      setIsLoadingProfileAfterRecognition(true);
      setStatusMessage(
        recognition.recognized
          ? dictionary.status.recognitionLoading(primaryDisplayName)
          : dictionary.status.similarCandidatesLoading,
      );

      const candidateDetails = await Promise.all(
        candidates.slice(0, resolvedUiConfig.maxResults).map(async (candidate, index) => {
          const fallback = pendingCandidates[index];

          if (!candidate.personId || !fallback) {
            return fallback;
          }

          try {
            const [person] = await searchPeople({
              personId: candidate.personId,
              includePhoto: false,
              limit: 1,
            });

            if (!person) {
              return fallback;
            }

            const isBestMatch = recognition.recognized && candidate.personId === primaryPersonId;

            return {
              ...mergePersonDetail(fallback, person),
              photo: isBestMatch ? imageBase64 : person.photo,
              hasPhoto: person.hasPhoto || isBestMatch,
              similarity: candidate.similarityPercent,
            };
          } catch {
            return fallback;
          }
        }),
      );

      const seenCandidates = new Set<string>();
      const enriched = candidateDetails.filter((person): person is PersonRecord => {
        if (!person) {
          return false;
        }

        const key = person.personId ? `id:${person.personId}` : `name:${person.displayName}`;
        if (seenCandidates.has(key)) {
          return false;
        }

        seenCandidates.add(key);
        return true;
      });

      if (enriched.length === 0) {
        setStatusMessage(dictionary.status.recognitionNoDetails(primaryDisplayName));
        return;
      }

      setSearchResults(enriched);
      setSelectedPerson(enriched[0]);

      try {
        const detailed = await loadPersonDetail(enriched[0]);
        setStatusMessage(
          recognition.recognized
            ? dictionary.status.similarCandidatesLoaded(detailed.displayName, enriched.length)
            : dictionary.status.similarCandidatesLowConfidence(enriched.length),
        );
      } catch {
        setStatusMessage(
          recognition.recognized
            ? dictionary.status.fullProfileFailed
            : dictionary.status.similarCandidatesLowConfidence(enriched.length),
        );
      }
    } catch (error) {
      setSearchResults([]);
      setSelectedPerson(null);
      setStatusMessage(getErrorMessage(error));
    } finally {
      setIsRecognizingImage(false);
      setIsLoadingProfileAfterRecognition(false);
    }
  }, [loadPersonDetail, resolvedUiConfig.maxResults, resolvedUiConfig.searchMinLength]);

  const handlePersonSelect = useCallback((person: PersonRecord) => {
    setSelectedPerson(person);

    if (person.personId && !person.photo) {
      void loadPersonDetail(person).catch(() => {
        setStatusMessage(dictionary.status.profileLookupFailed);
      });
    }
  }, [loadPersonDetail]);

  const handleFieldToggle = useCallback((field: string) => {
    setSelectedFields((prev) => (prev.includes(field) ? prev.filter((entry) => entry !== field) : [...prev, field]));
  }, []);

  const isBusy = isRecognizingImage || isSearchingByName;

  return (
    <div className="min-h-screen bg-background terminal-grid flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute top-2/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-secondary to-transparent" />
      </div>

      <div className="relative flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl">
        <motion.header className="mb-4 sm:mb-6" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-primary/20 border-2 border-primary shadow-[0_0_15px_rgba(52,211,153,0.3)]">
              <Terminal className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-2xl font-bold text-primary font-mono uppercase tracking-wider truncate">
                {dictionary.app.title}
              </h1>
              <p className="text-muted-foreground text-[10px] sm:text-xs font-mono mt-0.5">{dictionary.app.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
            <div className="flex items-center gap-1 sm:gap-1.5 bg-primary/10 border border-primary/30 text-primary px-1.5 sm:px-2 py-0.5 sm:py-1 font-mono">
              <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-pulse" />
              <span>{dictionary.badges.online}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 bg-card border border-border text-foreground px-1.5 sm:px-2 py-0.5 sm:py-1 font-mono">
              <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>{dictionary.badges.localMode}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 bg-card border border-border text-foreground px-1.5 sm:px-2 py-0.5 sm:py-1 font-mono">
              <Database className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>
                {recordsCount !== null
                  ? recordsCount.toLocaleString(dictionary.locale)
                  : dictionary.badges.unknownCount}{" "}
                {dictionary.badges.recordsSuffix}
              </span>
            </div>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4 sm:mb-6"
        >
          <div className="grid md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <label className="text-[10px] sm:text-xs font-mono text-primary mb-1.5 sm:mb-2 block uppercase tracking-wider">
                {dictionary.sections.imageLookup}
              </label>
              <ImageDropZone
                onImageDrop={handleImageSearch}
                isSearching={isRecognizingImage || isLoadingProfileAfterRecognition}
                compact={!!searchResults}
              />
            </div>
            <div>
              <label className="text-[10px] sm:text-xs font-mono text-primary mb-1.5 sm:mb-2 block uppercase tracking-wider">
                {dictionary.sections.nameLookup}
              </label>
              <div className="h-32 flex items-center">
                <SearchBar
                  onSearch={handleNameSearch}
                  disabled={isBusy}
                  isLoading={isSearchingByName}
                  minLength={resolvedUiConfig.searchMinLength}
                />
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="bg-card/70 border border-border px-3 py-2 text-[11px] sm:text-xs text-muted-foreground font-mono flex items-center gap-2">
              {(isSearchingByName || isRecognizingImage || isLoadingProfileAfterRecognition) && (
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}
        </motion.div>

        <AnimatePresence>
          {searchResults && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="lg:grid lg:grid-cols-12 lg:gap-4 space-y-4 lg:space-y-0">
                <div className="lg:col-span-3">
                  <div className="bg-card/50 border border-border p-2.5 sm:p-3 lg:sticky lg:top-4">
                    <div className="flex items-center gap-2 mb-2 sm:mb-3 pb-2 border-b border-border">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <h2 className="font-semibold text-foreground text-[10px] sm:text-xs font-mono uppercase">
                        {dictionary.sections.matches}
                      </h2>
                      <span className="ml-auto text-[9px] sm:text-[10px] text-muted-foreground font-mono">[{searchResults.length}]</span>
                    </div>
                    <SimilarMatchesList
                      matches={searchResults}
                      selectedId={selectedPerson?.id || null}
                      onSelect={handlePersonSelect}
                      personIdLabel={resolvedUiConfig.personIdLabel}
                    />
                  </div>
                </div>

                <div className="lg:col-span-6">
                  {selectedPerson && (
                    <PersonDetails
                      person={selectedPerson}
                      selectedFields={selectedFields}
                      fieldDefinitions={fieldDefinitions}
                      isLoading={isLoadingProfileAfterRecognition || isLoadingSelectedPerson}
                    />
                  )}
                </div>

                <div className="lg:col-span-3">
                  <div className="bg-card/50 border border-border p-2.5 sm:p-3 lg:sticky lg:top-4">
                    <div className="flex items-center gap-2 mb-2 sm:mb-3 pb-2 border-b border-border">
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                      <h2 className="font-semibold text-foreground text-[10px] sm:text-xs font-mono uppercase">
                        {dictionary.sections.visibleFields}
                      </h2>
                    </div>
                    <DataFieldSelector
                      fields={fieldDefinitions}
                      selectedFields={selectedFields}
                      onFieldToggle={handleFieldToggle}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {searchResults && searchResults.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 sm:py-12 bg-card/30 border border-border"
            >
              <Database className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-2 sm:mb-3" />
              <p className="text-muted-foreground font-mono text-xs sm:text-sm">{dictionary.emptyState.title}</p>
              <p className="text-muted-foreground/60 font-mono text-[10px] sm:text-xs mt-1">{dictionary.emptyState.subtitle}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-auto pt-4 sm:pt-6 pb-2 sm:pb-4 border-t border-border/50 text-center px-4"
      >
        <p className="text-muted-foreground font-mono text-[10px] sm:text-xs uppercase tracking-widest">
          {dictionary.app.footer}
        </p>
      </motion.footer>
    </div>
  );
}

export default App;
