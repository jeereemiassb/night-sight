export const dictionary = {
  locale: "en-US",
  app: {
    documentTitle: "NightSight",
    title: "NightSight",
    subtitle: "Local people lookup by face and name",
    footer: "Local-first identity explorer",
  },
  fallbackUiConfig: {
    personIdLabel: "Person ID",
  },
  badges: {
    online: "ONLINE",
    localMode: "LOCAL MODE",
    recordsSuffix: "RECORDS",
    unknownCount: "--",
  },
  sections: {
    imageLookup: "Image lookup",
    nameLookup: "Name lookup",
    matches: "Similar matches",
    visibleFields: "Visible fields",
  },
  search: {
    placeholder: "search --name '*Name*'",
    button: "Search",
    loading: "Searching",
    minLengthMessage: (minLength: number) => `Name search requires at least ${minLength} characters.`,
  },
  upload: {
    dragImage: "Drop an image here",
    uploadReady: "Image ready",
    helper: "or click to browse",
    scanning: "Analyzing image...",
    previewAlt: "Selected image",
  },
  status: {
    searchingByName: "Searching directory...",
    analyzingImage: "Analyzing image...",
    noMatchesByName: "No matches were found in the directory.",
    noValidFaceMatch: "No valid facial match was found.",
    profileLookupFailed: "The selected profile could not be loaded.",
    fullProfileFailed: "A result was found, but the full profile could not be loaded.",
    recognitionNoDetails: (name: string) => `Match found: ${name}. No detailed record was found.`,
    recognitionLoading: (name: string) => `Match found: ${name}. Loading profile...`,
    similarCandidatesLoading: "Loading similar candidates...",
    foundCount: (count: number) => `${count} ${count === 1 ? "match" : "matches"} found.`,
    profileLoaded: (name: string) => `Profile loaded: ${name}`,
    similarCandidatesLoaded: (name: string, count: number) =>
      `Profile loaded: ${name}. ${count} similar ${count === 1 ? "candidate" : "candidates"} shown.`,
    similarCandidatesLowConfidence: (count: number) =>
      `${count} similar ${count === 1 ? "candidate" : "candidates"} shown. No confident match.`,
  },
  person: {
    loadingProfile: "Loading profile",
    selected: "Profile selected",
    confidence: "Confidence",
    noFields: "No fields selected",
    unknownDisplayName: "UNKNOWN",
    unknownValue: "Not available",
  },
  emptyState: {
    title: "No matches found",
    subtitle: "Try a different name or another image.",
  },
  errors: {
    requestFailed: (status: number) => `Request failed (${status})`,
    unexpectedBackendError: "Unexpected backend error.",
  },
};
