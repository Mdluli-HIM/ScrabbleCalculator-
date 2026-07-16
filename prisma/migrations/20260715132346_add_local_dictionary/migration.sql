-- AlterEnum
ALTER TYPE "DictionaryPolicy" ADD VALUE 'LOCAL_WORD_LIST';

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "dictionaryLexiconId" TEXT;

-- CreateTable
CREATE TABLE "dictionary_lexicons" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dictionary_lexicons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary_words" (
    "id" TEXT NOT NULL,
    "lexiconId" TEXT NOT NULL,
    "word" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dictionary_words_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dictionary_lexicons_code_isCurrent_idx" ON "dictionary_lexicons"("code", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_lexicons_code_version_key" ON "dictionary_lexicons"("code", "version");

-- CreateIndex
CREATE INDEX "dictionary_words_word_idx" ON "dictionary_words"("word");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_words_lexiconId_word_key" ON "dictionary_words"("lexiconId", "word");

-- CreateIndex
CREATE INDEX "matches_dictionaryLexiconId_idx" ON "matches"("dictionaryLexiconId");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_dictionaryLexiconId_fkey" FOREIGN KEY ("dictionaryLexiconId") REFERENCES "dictionary_lexicons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_words" ADD CONSTRAINT "dictionary_words_lexiconId_fkey" FOREIGN KEY ("lexiconId") REFERENCES "dictionary_lexicons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only one version for each local lexicon code may be current.
CREATE UNIQUE INDEX
"dictionary_lexicons_one_current_per_code_idx"
ON "dictionary_lexicons"("code")
WHERE "isCurrent" = true;

-- A local match that has started must be connected to a
-- versioned local dictionary.
ALTER TABLE "matches"
ADD CONSTRAINT
"matches_started_local_dictionary_check"
CHECK (
  "dictionaryPolicy" <> 'LOCAL_WORD_LIST'
  OR "startedAt" IS NULL
  OR "dictionaryLexiconId" IS NOT NULL
);
