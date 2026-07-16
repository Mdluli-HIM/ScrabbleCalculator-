export interface DictionaryWordValidation {
  submittedWord: string;
  normalizedWord: string;
  accepted: boolean;
  suggestions: string[];
}

export interface DictionaryLexiconSummary {
  code: string;
  version: string;
  name: string;
}

export interface DictionaryValidationResult {
  matchId: string;
  dictionaryPolicy: "LOCAL_WORD_LIST";
  lexicon: DictionaryLexiconSummary;
  accepted: boolean;
  words: DictionaryWordValidation[];
}
