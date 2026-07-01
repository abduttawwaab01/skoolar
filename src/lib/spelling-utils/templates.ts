import { type SpellingConfig, DEFAULT_SPELLING_CONFIG } from './types';

const clone = (partial: Partial<SpellingConfig>): SpellingConfig => ({
  ...DEFAULT_SPELLING_CONFIG,
  ...partial,
});

export const TEMPLATE_PRESETS: Record<string, SpellingConfig> = {
  'spelling-list': clone({
    templateId: 'spelling-list',
    sheetTitle: 'Weekly Spelling List',
    wordList: 'beautiful\nmountain\nimportant\nremember\ndifferent\nwonderful\ndangerous\nadventure\nknowledge\nexperience',
    showTraceLines: true,
    showSentenceLines: true,
    numberOfColumns: 2,
  }),

  'vocabulary-builder': clone({
    templateId: 'vocabulary-builder',
    sheetTitle: 'Vocabulary Builder',
    wordList: 'benevolent:kindly and generous\nmelancholy:a feeling of sadness\nenormous:very large in size\ncurious:eager to learn or know\nbrave:ready to face danger',
    showDefinitions: true,
    showSentenceLines: true,
    showIllustrationBoxes: true,
    numberOfColumns: 1,
    showTraceLines: false,
  }),

  'dictation-sheet': clone({
    templateId: 'dictation-sheet',
    sheetTitle: 'Dictation Sheet',
    wordList: '1\n2\n3\n4\n5\n6\n7\n8\n9\n10',
    showDefinitions: false,
    showSentenceLines: false,
    showIllustrationBoxes: false,
    showTraceLines: false,
    numberOfColumns: 1,
  }),

  'word-family': clone({
    templateId: 'word-family',
    sheetTitle: 'Word Families',
    wordList: 'bat:family=-at\ncat:family=-at\nhat:family=-at\nmat:family=-at\nrat:family=-at\nbin:family=-in\npin:family=-in\ntin:family=-in\nwin:family=-in\nfin:family=-in',
    showTraceLines: true,
    showSentenceLines: true,
    numberOfColumns: 2,
  }),

  'sentence-writing': clone({
    templateId: 'sentence-writing',
    sheetTitle: 'Sentence Writing',
    wordList: 'adventure\ncurious\nimagine\ndiscover\nwonderful\nbrave',
    showDefinitions: false,
    showSentenceLines: false,
    showIllustrationBoxes: true,
    showTraceLines: false,
    numberOfColumns: 2,
  }),
};
