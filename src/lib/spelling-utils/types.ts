export type SpellingTemplateId =
  | 'spelling-list'
  | 'vocabulary-builder'
  | 'dictation-sheet'
  | 'word-family'
  | 'sentence-writing';

export interface SpellingConfig {
  templateId: SpellingTemplateId;
  sheetTitle: string;
  studentName: string;
  date: string;
  wordList: string;
  showDefinitions: boolean;
  showSentenceLines: boolean;
  showIllustrationBoxes: boolean;
  showTraceLines: boolean;
  numberOfColumns: number;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  showNameField: boolean;
  showDateField: boolean;
  showTitleField: boolean;
  orientation: 'portrait' | 'landscape';
  paperSize: 'a4' | 'letter';
  margins: number;
}

export interface SpellingTemplateMeta {
  id: SpellingTemplateId;
  name: string;
  description: string;
  bestFor: string;
  tags: string[];
}

export const SPELLING_COLUMN_OPTIONS = [1, 2, 3];

export const TEMPLATE_META: Record<SpellingTemplateId, SpellingTemplateMeta> = {
  'spelling-list': {
    id: 'spelling-list',
    name: 'Spelling List',
    description: 'Word list with trace, write, and sentence lines per word',
    bestFor: 'Weekly spelling practice, sight word drill',
    tags: ['spelling', 'trace', 'write', 'sentence'],
  },
  'vocabulary-builder': {
    id: 'vocabulary-builder',
    name: 'Vocabulary Builder',
    description: 'Word, definition, sentence, and illustration box for each word',
    bestFor: 'Building vocabulary, understanding word meanings',
    tags: ['vocabulary', 'definition', 'illustration', 'comprehension'],
  },
  'dictation-sheet': {
    id: 'dictation-sheet',
    name: 'Dictation Sheet',
    description: 'Numbered blank lines for teacher-led dictation exercises',
    bestFor: 'Dictation tests, spelling assessments, listening skills',
    tags: ['dictation', 'listening', 'assessment', 'spelling-test'],
  },
  'word-family': {
    id: 'word-family',
    name: 'Word Families',
    description: 'Group words by word family (-at, -an, -it) with trace/write practice',
    bestFor: 'Phonics instruction, word pattern recognition',
    tags: ['phonics', 'word-family', 'patterns', 'early-literacy'],
  },
  'sentence-writing': {
    id: 'sentence-writing',
    name: 'Sentence Writing',
    description: 'Given words, write a sentence for each with illustration space',
    bestFor: 'Creative writing, grammar practice, sentence construction',
    tags: ['writing', 'sentences', 'grammar', 'creative'],
  },
};

export const DEFAULT_SPELLING_CONFIG: SpellingConfig = {
  templateId: 'spelling-list',
  sheetTitle: 'Spelling Practice',
  studentName: '',
  date: new Date().toISOString().split('T')[0],
  wordList: 'beautiful\nmountain\nimportant\nremember\ndifferent\nwonderful\ndangerous\nadventure',
  showDefinitions: false,
  showSentenceLines: true,
  showIllustrationBoxes: false,
  showTraceLines: true,
  numberOfColumns: 2,
  primaryColor: '#6366f1',
  backgroundColor: '#ffffff',
  textColor: '#1e293b',
  fontSize: 16,
  showNameField: true,
  showDateField: true,
  showTitleField: true,
  orientation: 'portrait',
  paperSize: 'a4',
  margins: 20,
};

export function parseWordList(text: string): string[] {
  return text
    .split('\n')
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

export function parseVocabularyWord(line: string): { word: string; definition: string } {
  const colonIdx = line.indexOf(':');
  if (colonIdx > 0) {
    return {
      word: line.substring(0, colonIdx).trim(),
      definition: line.substring(colonIdx + 1).trim(),
    };
  }
  return { word: line.trim(), definition: '' };
}

export function parseWordFamilyWord(line: string): { word: string; family?: string } {
  const familyMatch = line.match(/^(.+?)\s*:\s*family\s*=\s*(.+)$/i);
  if (familyMatch) {
    return { word: familyMatch[1].trim(), family: familyMatch[2].trim() };
  }
  const dashMatch = line.match(/^(.+?)\s*-\s*(.+)$/);
  if (dashMatch) {
    const word = dashMatch[1].trim();
    const family = dashMatch[2].trim();
    const familyWords = ['at', 'an', 'it', 'ot', 'et', 'ig', 'og', 'ug', 'un', 'in', 'ap', 'ip', 'op', 'am', 'ad', 'ed', 'id', 'ab', 'ob', 'ub'];
    if (familyWords.includes(family)) {
      return { word, family: `-${family}` };
    }
    return { word, family };
  }
  return { word: line.trim() };
}
