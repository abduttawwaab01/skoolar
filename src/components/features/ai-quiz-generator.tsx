'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Brain, Shuffle, Plus, Download, Printer, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  number: number;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  text: string;
  options?: string[];
  correctAnswer: string;
  isEdited?: boolean;
}

interface QuizConfig {
  subject: string;
  topic: string;
  questionCount: number;
  difficulty: string;
  questionType: string;
  quizTitle: string;
}

interface QuizStats {
  totalGenerated: number;
  avgQuestions: number;
  subjectsCovered: string[];
}

// ── Question Banks ───────────────────────────────────────────────────────────

const questionBanks: Record<string, Record<string, Question[]>> = {
  Mathematics: {
    'Algebra': [
      { id: 'm-alg-1', number: 1, type: 'multiple-choice', text: 'Solve for x: 3x + 7 = 22', options: ['x = 3', 'x = 5', 'x = 7', 'x = 15'], correctAnswer: 'x = 5' },
      { id: 'm-alg-2', number: 2, type: 'multiple-choice', text: 'What is the value of y in the equation 2y - 8 = 12?', options: ['y = 2', 'y = 8', 'y = 10', 'y = 20'], correctAnswer: 'y = 10' },
      { id: 'm-alg-3', number: 3, type: 'true-false', text: 'In the equation ax + b = c, x = (c - b) / a.', correctAnswer: 'True' },
      { id: 'm-alg-4', number: 4, type: 'short-answer', text: 'Expand and simplify: (x + 3)(x - 2)', correctAnswer: 'x² + x - 6' },
      { id: 'm-alg-5', number: 5, type: 'multiple-choice', text: 'Which expression represents the quadratic formula?', options: ['x = -b ± √(b² - 4ac) / 2a', 'x = -b ± √(b² + 4ac) / 2a', 'x = b ± √(b² - 4ac) / a', 'x = -b ± √(b² - 4ac) / 4a'], correctAnswer: 'x = -b ± √(b² - 4ac) / 2a' },
      { id: 'm-alg-6', number: 6, type: 'multiple-choice', text: 'Factorize: x² - 9', options: ['(x - 3)(x - 3)', '(x + 3)(x + 3)', '(x + 3)(x - 3)', '(x - 9)(x + 1)'], correctAnswer: '(x + 3)(x - 3)' },
      { id: 'm-alg-7', number: 7, type: 'true-false', text: 'The equation 2x + 5 = 5 has exactly one solution.', correctAnswer: 'True' },
      { id: 'm-alg-8', number: 8, type: 'short-answer', text: 'Solve the simultaneous equations: x + y = 10, x - y = 4. What is x?', correctAnswer: 'x = 7' },
      { id: 'm-alg-9', number: 9, type: 'multiple-choice', text: 'What is the slope of the line 2x - 4y = 8?', options: ['1/2', '-1/2', '2', '-2'], correctAnswer: '1/2' },
      { id: 'm-alg-10', number: 10, type: 'short-answer', text: 'If f(x) = 3x - 1, find f(4).', correctAnswer: 'f(4) = 11' },
    ],
    'Geometry': [
      { id: 'm-geo-1', number: 1, type: 'multiple-choice', text: 'What is the area of a circle with radius 7 cm? (Use π = 22/7)', options: ['44 cm²', '154 cm²', '308 cm²', '77 cm²'], correctAnswer: '154 cm²' },
      { id: 'm-geo-2', number: 2, type: 'multiple-choice', text: 'The sum of interior angles of a triangle is:', options: ['90°', '180°', '270°', '360°'], correctAnswer: '180°' },
      { id: 'm-geo-3', number: 3, type: 'true-false', text: 'A square is a special type of rectangle.', correctAnswer: 'True' },
      { id: 'm-geo-4', number: 4, type: 'short-answer', text: 'Find the perimeter of a rectangle with length 12 cm and width 8 cm.', correctAnswer: '40 cm' },
      { id: 'm-geo-5', number: 5, type: 'multiple-choice', text: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], correctAnswer: '6' },
      { id: 'm-geo-6', number: 6, type: 'multiple-choice', text: 'The Pythagorean theorem states that a² + b² = c². This applies to:', options: ['Any triangle', 'Right-angled triangles', 'Equilateral triangles', 'Isosceles triangles'], correctAnswer: 'Right-angled triangles' },
      { id: 'm-geo-7', number: 7, type: 'true-false', text: 'The diameter of a circle is half of its radius.', correctAnswer: 'False' },
      { id: 'm-geo-8', number: 8, type: 'short-answer', text: 'Calculate the volume of a cuboid with dimensions 5 cm × 3 cm × 4 cm.', correctAnswer: '60 cm³' },
    ],
    'Statistics': [
      { id: 'm-stat-1', number: 1, type: 'multiple-choice', text: 'What is the mean of 4, 8, 12, 16, 20?', options: ['10', '12', '14', '16'], correctAnswer: '12' },
      { id: 'm-stat-2', number: 2, type: 'multiple-choice', text: 'The median of the data set 3, 5, 7, 9, 11 is:', options: ['5', '7', '9', '6'], correctAnswer: '7' },
      { id: 'm-stat-3', number: 3, type: 'true-false', text: 'The mode is the value that appears most frequently in a data set.', correctAnswer: 'True' },
      { id: 'm-stat-4', number: 4, type: 'short-answer', text: 'Find the range of the data set: 15, 23, 8, 42, 31, 19.', correctAnswer: '34' },
      { id: 'm-stat-5', number: 5, type: 'multiple-choice', text: 'A pie chart is best used to show:', options: ['Trends over time', 'Proportions of a whole', 'Relationships between variables', 'Exact values'], correctAnswer: 'Proportions of a whole' },
      { id: 'm-stat-6', number: 6, type: 'multiple-choice', text: 'In a bar chart, the height of each bar represents:', options: ['A category', 'A frequency or value', 'A time period', 'A percentage of total'], correctAnswer: 'A frequency or value' },
    ],
  },
  'English Language': {
    'Grammar': [
      { id: 'e-gra-1', number: 1, type: 'multiple-choice', text: 'Choose the correct sentence:', options: ['She don\'t like mangoes.', 'She doesn\'t likes mangoes.', 'She doesn\'t like mangoes.', 'She not like mangoes.'], correctAnswer: 'She doesn\'t like mangoes.' },
      { id: 'e-gra-2', number: 2, type: 'multiple-choice', text: 'Which word is a conjunction?', options: ['Quickly', 'Beautiful', 'Because', 'Under'], correctAnswer: 'Because' },
      { id: 'e-gra-3', number: 3, type: 'true-false', text: 'An adverb modifies a noun.', correctAnswer: 'False' },
      { id: 'e-gra-4', number: 4, type: 'short-answer', text: 'Identify the part of speech of the word "quickly" in: "She ran quickly to school."', correctAnswer: 'Adverb' },
      { id: 'e-gra-5', number: 5, type: 'multiple-choice', text: 'Choose the correct verb form: "The boys _____ playing football."', options: ['is', 'are', 'was', 'has'], correctAnswer: 'are' },
      { id: 'e-gra-6', number: 6, type: 'multiple-choice', text: 'Which sentence uses the passive voice?', options: ['The cat chased the mouse.', 'The mouse was chased by the cat.', 'The cat is chasing the mouse.', 'The cat chases mice.'], correctAnswer: 'The mouse was chased by the cat.' },
      { id: 'e-gra-7', number: 7, type: 'true-false', text: '"Their" and "there" have the same meaning.', correctAnswer: 'False' },
      { id: 'e-gra-8', number: 8, type: 'short-answer', text: 'What is the plural form of "child"?', correctAnswer: 'Children' },
    ],
    'Comprehension': [
      { id: 'e-comp-1', number: 1, type: 'multiple-choice', text: 'In a comprehension passage, the main idea is usually found in:', options: ['The first sentence of each paragraph', 'The last paragraph only', 'Random sentences throughout', 'The title only'], correctAnswer: 'The first sentence of each paragraph' },
      { id: 'e-comp-2', number: 2, type: 'multiple-choice', text: 'When answering "In your own words," you should:', options: ['Copy the passage exactly', 'Paraphrase the idea using different words', 'Skip the question', 'Write a summary'], correctAnswer: 'Paraphrase the idea using different words' },
      { id: 'e-comp-3', number: 3, type: 'true-false', text: 'The word "however" is used to show similarity between ideas.', correctAnswer: 'False' },
      { id: 'e-comp-4', number: 4, type: 'short-answer', text: 'What is the meaning of "benevolent" in the context of a kind leader?', correctAnswer: 'Kind, generous, or well-meaning' },
      { id: 'e-comp-5', number: 5, type: 'multiple-choice', text: 'An inference is:', options: ['A fact stated directly in the text', 'A conclusion drawn from evidence and reasoning', 'The author\'s opinion', 'A definition from the dictionary'], correctAnswer: 'A conclusion drawn from evidence and reasoning' },
    ],
    'Vocabulary': [
      { id: 'e-voc-1', number: 1, type: 'multiple-choice', text: 'What does "abundant" mean?', options: ['Scarce', 'Plentiful', 'Tiny', 'Heavy'], correctAnswer: 'Plentiful' },
      { id: 'e-voc-2', number: 2, type: 'multiple-choice', text: 'Choose the synonym of "courageous":', options: ['Fearful', 'Timid', 'Brave', 'Careless'], correctAnswer: 'Brave' },
      { id: 'e-voc-3', number: 3, type: 'true-false', text: '"Eloquent" means having fluent or persuasive speaking or writing.', correctAnswer: 'True' },
      { id: 'e-voc-4', number: 4, type: 'short-answer', text: 'Give the antonym (opposite) of "generous."', correctAnswer: 'Selfish or stingy' },
      { id: 'e-voc-5', number: 5, type: 'multiple-choice', text: 'Which word means "happening yearly"?', options: ['Biannual', 'Annual', 'Perennial', 'Centennial'], correctAnswer: 'Annual' },
      { id: 'e-voc-6', number: 6, type: 'multiple-choice', text: '"Mitigate" means to:', options: ['Worsen', 'Make less severe', 'Create', 'Ignore'], correctAnswer: 'Make less severe' },
    ],
  },
  'Basic Science': {
    'Matter': [
      { id: 'bs-mat-1', number: 1, type: 'multiple-choice', text: 'Which of the following is NOT a state of matter?', options: ['Solid', 'Liquid', 'Gas', 'Energy'], correctAnswer: 'Energy' },
      { id: 'bs-mat-2', number: 2, type: 'multiple-choice', text: 'In which state of matter do particles move the most freely?', options: ['Solid', 'Liquid', 'Gas', 'Plasma'], correctAnswer: 'Gas' },
      { id: 'bs-mat-3', number: 3, type: 'true-false', text: 'Evaporation is the process of a liquid turning into a gas.', correctAnswer: 'True' },
      { id: 'bs-mat-4', number: 4, type: 'short-answer', text: 'Name the process by which a solid turns directly into a gas without becoming a liquid first.', correctAnswer: 'Sublimation' },
      { id: 'bs-mat-5', number: 5, type: 'multiple-choice', text: 'The boiling point of water at sea level is:', options: ['50°C', '75°C', '100°C', '120°C'], correctAnswer: '100°C' },
      { id: 'bs-mat-6', number: 6, type: 'multiple-choice', text: 'An atom is the smallest unit of:', options: ['A molecule', 'An element that retains its chemical properties', 'A compound', 'A mixture'], correctAnswer: 'An element that retains its chemical properties' },
      { id: 'bs-mat-7', number: 7, type: 'true-false', text: 'A mixture can be separated by physical methods.', correctAnswer: 'True' },
      { id: 'bs-mat-8', number: 8, type: 'short-answer', text: 'What is the difference between an element and a compound?', correctAnswer: 'An element is made of one type of atom, while a compound is made of two or more different atoms chemically bonded.' },
    ],
    'Living Things': [
      { id: 'bs-liv-1', number: 1, type: 'multiple-choice', text: 'Which of the following is NOT a characteristic of living things?', options: ['Movement', 'Respiration', 'Decay', 'Growth'], correctAnswer: 'Decay' },
      { id: 'bs-liv-2', number: 2, type: 'multiple-choice', text: 'Photosynthesis occurs in which part of the plant cell?', options: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Cell wall'], correctAnswer: 'Chloroplast' },
      { id: 'bs-liv-3', number: 3, type: 'true-false', text: 'All living things need oxygen to survive.', correctAnswer: 'False' },
      { id: 'bs-liv-4', number: 4, type: 'short-answer', text: 'Name the process by which plants make their own food using sunlight.', correctAnswer: 'Photosynthesis' },
      { id: 'bs-liv-5', number: 5, type: 'multiple-choice', text: 'Which organelle is known as the "powerhouse of the cell"?', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi body'], correctAnswer: 'Mitochondria' },
      { id: 'bs-liv-6', number: 6, type: 'multiple-choice', text: 'The basic unit of life is:', options: ['Atom', 'Molecule', 'Cell', 'Tissue'], correctAnswer: 'Cell' },
    ],
  },
  'Social Studies': {
    'Government': [
      { id: 'ss-gov-1', number: 1, type: 'multiple-choice', text: 'How many branches of government are there in a democratic system?', options: ['2', '3', '4', '5'], correctAnswer: '3' },
      { id: 'ss-gov-2', number: 2, type: 'multiple-choice', text: 'The legislative arm of government is responsible for:', options: ['Enforcing laws', 'Making laws', 'Interpreting laws', 'Funding laws'], correctAnswer: 'Making laws' },
      { id: 'ss-gov-3', number: 3, type: 'true-false', text: 'The judiciary interprets the law.', correctAnswer: 'True' },
      { id: 'ss-gov-4', number: 4, type: 'short-answer', text: 'What is the name of Nigeria\'s national legislature?', correctAnswer: 'National Assembly (Senate and House of Representatives)' },
      { id: 'ss-gov-5', number: 5, type: 'multiple-choice', text: 'A system where power is shared between central and regional governments is called:', options: ['Unitary', 'Federal', 'Confederal', 'Monarchy'], correctAnswer: 'Federal' },
      { id: 'ss-gov-6', number: 6, type: 'multiple-choice', text: 'Democracy literally means "rule by the":', options: ['King', 'Rich', 'People', 'Military'], correctAnswer: 'People' },
      { id: 'ss-gov-7', number: 7, type: 'true-false', text: 'In a dictatorship, the citizens have the right to vote for their leaders.', correctAnswer: 'False' },
      { id: 'ss-gov-8', number: 8, type: 'short-answer', text: 'Name two types of democracy.', correctAnswer: 'Direct democracy and Representative (indirect) democracy' },
    ],
    'Citizenship': [
      { id: 'ss-cit-1', number: 1, type: 'multiple-choice', text: 'Which of the following is a RIGHT of a citizen?', options: ['Paying taxes', 'Voting in elections', 'Obeying laws', 'Attending school'], correctAnswer: 'Voting in elections' },
      { id: 'ss-cit-2', number: 2, type: 'multiple-choice', text: 'A citizen by birth is someone who:', options: ['Immigrated to the country', 'Was born in the country or to citizen parents', 'Married a citizen', 'Passed a citizenship test'], correctAnswer: 'Was born in the country or to citizen parents' },
      { id: 'ss-cit-3', number: 3, type: 'true-false', text: 'National service (like NYSC) is a civic duty in Nigeria.', correctAnswer: 'True' },
      { id: 'ss-cit-4', number: 4, type: 'short-answer', text: 'Name two responsibilities of a good citizen.', correctAnswer: 'Voting, paying taxes, obeying laws, defending the country, participating in community service (any two)' },
      { id: 'ss-cit-5', number: 5, type: 'multiple-choice', text: 'Human rights are:', options: ['Granted by the government only', 'Fundamental rights inherent to all human beings', 'Only for adults', 'Only for citizens'], correctAnswer: 'Fundamental rights inherent to all human beings' },
    ],
  },
  'Computer Studies': {
    'Hardware': [
      { id: 'cs-hw-1', number: 1, type: 'multiple-choice', text: 'Which of the following is an input device?', options: ['Monitor', 'Printer', 'Keyboard', 'Speaker'], correctAnswer: 'Keyboard' },
      { id: 'cs-hw-2', number: 2, type: 'multiple-choice', text: 'CPU stands for:', options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Processing Unit'], correctAnswer: 'Central Processing Unit' },
      { id: 'cs-hw-3', number: 3, type: 'true-false', text: 'RAM is volatile memory, meaning data is lost when power is turned off.', correctAnswer: 'True' },
      { id: 'cs-hw-4', number: 4, type: 'short-answer', text: 'What is the difference between RAM and ROM?', correctAnswer: 'RAM is volatile temporary memory; ROM is non-volatile permanent memory that stores startup instructions.' },
      { id: 'cs-hw-5', number: 5, type: 'multiple-choice', text: 'Which device is used to produce hard copies?', options: ['Monitor', 'Scanner', 'Printer', 'Projector'], correctAnswer: 'Printer' },
      { id: 'cs-hw-6', number: 6, type: 'multiple-choice', text: 'The "brain" of the computer is:', options: ['RAM', 'Hard Drive', 'CPU', 'Motherboard'], correctAnswer: 'CPU' },
    ],
    'Programming': [
      { id: 'cs-prg-1', number: 1, type: 'multiple-choice', text: 'An algorithm is:', options: ['A programming language', 'A step-by-step procedure to solve a problem', 'A type of computer', 'A hardware component'], correctAnswer: 'A step-by-step procedure to solve a problem' },
      { id: 'cs-prg-2', number: 2, type: 'multiple-choice', text: 'Which of the following is NOT a programming language?', options: ['Python', 'HTML', 'Java', 'Flowchart'], correctAnswer: 'Flowchart' },
      { id: 'cs-prg-3', number: 3, type: 'true-false', text: 'A flowchart uses symbols to represent the steps in an algorithm.', correctAnswer: 'True' },
      { id: 'cs-prg-4', number: 4, type: 'short-answer', text: 'What is the purpose of a "loop" in programming?', correctAnswer: 'A loop repeats a block of code multiple times until a condition is met.' },
      { id: 'cs-prg-5', number: 5, type: 'multiple-choice', text: 'In programming, a "variable" is:', options: ['A fixed value', 'A named storage location for data', 'A type of loop', 'An output device'], correctAnswer: 'A named storage location for data' },
      { id: 'cs-prg-6', number: 6, type: 'multiple-choice', text: 'The symbol used for assignment in most programming languages is:', options: ['==', '=', '!=', ':='], correctAnswer: '=' },
    ],
    'Networking': [
      { id: 'cs-net-1', number: 1, type: 'multiple-choice', text: 'LAN stands for:', options: ['Large Area Network', 'Local Area Network', 'Long Area Network', 'Linked Area Network'], correctAnswer: 'Local Area Network' },
      { id: 'cs-net-2', number: 2, type: 'multiple-choice', text: 'The internet is a network of:', options: ['Computers in one room', 'Interconnected computer networks worldwide', 'Mobile devices only', 'Government computers'], correctAnswer: 'Interconnected computer networks worldwide' },
      { id: 'cs-net-3', number: 3, type: 'true-false', text: 'A router is used to connect different networks together.', correctAnswer: 'True' },
      { id: 'cs-net-4', number: 4, type: 'short-answer', text: 'What is the purpose of an IP address?', correctAnswer: 'An IP address uniquely identifies a device on a network, allowing data to be sent to and from the correct destination.' },
      { id: 'cs-net-5', number: 5, type: 'multiple-choice', text: 'Which protocol is used for secure web browsing?', options: ['HTTP', 'FTP', 'HTTPS', 'SMTP'], correctAnswer: 'HTTPS' },
    ],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const subjectsList = Object.keys(questionBanks);

function getTopics(subject: string): string[] {
  return Object.keys(questionBanks[subject] || {});
}

function generateQuiz(config: QuizConfig): Question[] {
  const bank = questionBanks[config.subject]?.[config.topic];
  if (!bank) return [];

  let pool = [...bank];

  // Filter by question type if specified
  if (config.questionType !== 'mixed') {
    pool = pool.filter(q => q.type === config.questionType);
  }

  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Take requested count (or however many available)
  const count = Math.min(config.questionCount, pool.length);
  return pool.slice(0, count).map((q, i) => ({
    ...q,
    id: `gen-${Date.now()}-${i}`,
    number: i + 1,
  }));
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AIQuizGenerator() {
  const [config, setConfig] = useState<QuizConfig>({
    subject: '',
    topic: '',
    questionCount: 5,
    difficulty: 'Medium',
    questionType: 'mixed',
    quizTitle: '',
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [savedQuizzes, setSavedQuizzes] = useState<QuizStats>({ totalGenerated: 12, avgQuestions: 7, subjectsCovered: ['Mathematics', 'English Language', 'Basic Science', 'Computer Studies'] });
  const [showAnswers, setShowAnswers] = useState(false);

  const topics = config.subject ? getTopics(config.subject) : [];
  const totalQuestions = questionBanks[config.subject]?.[config.topic]?.length || 0;

  const handleGenerate = useCallback(() => {
    if (!config.subject) {
      toast.error('Please select a subject');
      return;
    }
    if (!config.topic) {
      toast.error('Please select a topic');
      return;
    }

    setIsGenerating(true);
    setGenerateProgress(0);
    setQuestions([]);
    setEditingId(null);
    setShowAnswers(false);

    const interval = setInterval(() => {
      setGenerateProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.random() * 20;
      });
    }, 300);

    setTimeout(() => {
      clearInterval(interval);
      setGenerateProgress(100);
      const generated = generateQuiz(config);

      setTimeout(() => {
        setQuestions(generated);
        setIsGenerating(false);
        setGenerateProgress(0);

        if (generated.length === 0) {
          toast.error('No questions available for this combination. Try different settings.');
        } else {
          toast.success(`Quiz generated with ${generated.length} question${generated.length > 1 ? 's' : ''}!`);
        }
      }, 400);
    }, 2000);
  }, [config]);

  const handleEditQuestion = useCallback((q: Question) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditAnswer(q.correctAnswer);
    setEditOptions(q.options ? [...q.options] : []);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    setQuestions(prev => prev.map(q =>
      q.id === editingId
        ? { ...q, text: editText, correctAnswer: editAnswer, options: editOptions.length > 0 ? editOptions : q.options, isEdited: true }
        : q
    ));
    setEditingId(null);
    toast.success('Question updated');
  }, [editingId, editText, editAnswer, editOptions]);

  const handleSaveQuiz = useCallback(() => {
    if (questions.length === 0) {
      toast.error('No quiz to save');
      return;
    }

    const quizData = {
      title: config.quizTitle || `${config.subject} - ${config.topic} Quiz`,
      subject: config.subject,
      topic: config.topic,
      difficulty: config.difficulty,
      questions,
      createdAt: new Date().toISOString(),
    };

    // Save to localStorage as a mock
    const existing = JSON.parse(localStorage.getItem('savedQuizzes') || '[]');
    existing.push(quizData);
    localStorage.setItem('savedQuizzes', JSON.stringify(existing));

    setSavedQuizzes(prev => ({
      totalGenerated: prev.totalGenerated + 1,
      avgQuestions: Math.round((prev.avgQuestions + questions.length) / 2),
      subjectsCovered: prev.subjectsCovered.includes(config.subject) ? prev.subjectsCovered : [...prev.subjectsCovered, config.subject],
    }));

    toast.success(`Quiz "${quizData.title}" saved successfully!`);
  }, [questions, config]);

  const handlePrintQuiz = useCallback(() => {
    if (questions.length === 0) {
      toast.error('No quiz to print');
      return;
    }

    const title = config.quizTitle || `${config.subject} - ${config.topic} Quiz`;
    let printContent = `QUIZ: ${title}\nSubject: ${config.subject} | Topic: ${config.topic} | Difficulty: ${config.difficulty}\nDate: ${new Date().toLocaleDateString()}\n${'='.repeat(60)}\n\n`;

    questions.forEach((q, i) => {
      printContent += `Q${i + 1}. ${q.text}\n`;
      if (q.options) {
        q.options.forEach((opt, j) => {
          printContent += `    ${String.fromCharCode(65 + j)}. ${opt}\n`;
        });
      }
      printContent += `    Answer: ${q.correctAnswer}\n\n`;
    });

    const blob = new Blob([printContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => { printWindow.print(); };
    }
    toast.success('Print dialog opened');
  }, [questions, config]);

  const handleCopyQuiz = useCallback(() => {
    if (questions.length === 0) {
      toast.error('No quiz to copy');
      return;
    }

    const title = config.quizTitle || `${config.subject} - ${config.topic} Quiz`;
    let text = `📝 ${title}\n`;
    text += `Subject: ${config.subject} | Topic: ${config.topic} | Difficulty: ${config.difficulty}\n\n`;

    questions.forEach((q, i) => {
      text += `Q${i + 1}. ${q.text}\n`;
      if (q.options) {
        q.options.forEach((opt, j) => {
          text += `  ${String.fromCharCode(65 + j)}. ${opt}\n`;
        });
      }
      text += `  ✅ Answer: ${q.correctAnswer}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      toast.success('Quiz copied to clipboard');
    });
  }, [questions, config]);

  const addCustomOption = () => {
    setEditOptions(prev => [...prev, '']);
  };

  const updateOption = (index: number, value: string) => {
    setEditOptions(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const removeOption = (index: number) => {
    setEditOptions(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <Brain className="h-6 w-6 text-amber-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Quiz Generator</h2>
            <p className="text-sm text-gray-500">Automatically generate educational quizzes for your students</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 text-sm">
          <Shuffle className="h-3.5 w-3.5 text-amber-500" />
          {savedQuizzes.totalGenerated} quizzes generated
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700 font-medium">Total Quizzes Generated</p>
                <p className="text-3xl font-bold text-amber-800">{savedQuizzes.totalGenerated}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-100">
                <Shuffle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Average Questions per Quiz</p>
                <p className="text-3xl font-bold text-blue-800">{savedQuizzes.avgQuestions}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-100">
                <Plus className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-700 font-medium">Subjects Covered</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {savedQuizzes.subjectsCovered.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">{s}</Badge>
                  ))}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shuffle className="h-5 w-5 text-amber-500" />
              Quiz Configuration
            </CardTitle>
            <CardDescription>Set up your quiz parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quiz Title */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Quiz Title (optional)</label>
              <Input
                placeholder="e.g., Mid-term Algebra Test"
                value={config.quizTitle}
                onChange={(e) => setConfig(prev => ({ ...prev, quizTitle: e.target.value }))}
              />
            </div>

            <Separator />

            {/* Subject */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject *</label>
              <Select value={config.subject} onValueChange={(v) => setConfig(prev => ({ ...prev, subject: v, topic: '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjectsList.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Topic */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Topic *</label>
              <Select value={config.topic} onValueChange={(v) => setConfig(prev => ({ ...prev, topic: v }))} disabled={!config.subject}>
                <SelectTrigger>
                  <SelectValue placeholder={config.subject ? 'Select topic' : 'Pick a subject first'} />
                </SelectTrigger>
                <SelectContent>
                  {topics.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {config.subject && config.topic && (
                <p className="text-xs text-gray-400 mt-1">{totalQuestions} questions available in bank</p>
              )}
            </div>

            {/* Number of Questions */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Number of Questions</label>
              <Select value={String(config.questionCount)} onValueChange={(v) => setConfig(prev => ({ ...prev, questionCount: parseInt(v) }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 8, 10, 15, 20].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Difficulty</label>
              <Select value={config.difficulty} onValueChange={(v) => setConfig(prev => ({ ...prev, difficulty: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Question Type */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Question Type</label>
              <Select value={config.questionType} onValueChange={(v) => setConfig(prev => ({ ...prev, questionType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed (All Types)</SelectItem>
                  <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                  <SelectItem value="true-false">True / False</SelectItem>
                  <SelectItem value="short-answer">Short Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Generate Button */}
            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2 bg-amber-600 hover:bg-amber-700">
              {isGenerating ? (
                <>
                  <Shuffle className="h-4 w-4 animate-spin" />
                  Generating... {Math.round(generateProgress)}%
                </>
              ) : (
                <>
                  <Shuffle className="h-4 w-4" />
                  Generate Quiz
                </>
              )}
            </Button>

            {isGenerating && (
              <div className="space-y-1.5">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${generateProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  AI is selecting the best questions...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quiz Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Quiz Preview</CardTitle>
                <CardDescription>
                  {questions.length > 0
                    ? `${questions.length} question${questions.length > 1 ? 's' : ''} generated`
                    : 'Configure and generate a quiz to see the preview'}
                </CardDescription>
              </div>
              {questions.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAnswers(prev => !prev)}
                    className="gap-1.5 text-xs"
                  >
                    {showAnswers ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    {showAnswers ? 'Hide Answers' : 'Show Answers'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyQuiz} className="gap-1.5 text-xs">
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrintQuiz} className="gap-1.5 text-xs">
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSaveQuiz} className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-4 rounded-full bg-gray-100 mx-auto w-fit mb-4">
                  <Shuffle className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No quiz generated yet</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
                  Configure your quiz settings on the left and click &quot;Generate Quiz&quot; to create an AI-powered quiz.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg mx-auto">
                  {subjectsList.slice(0, 4).map(s => (
                    <div key={s} className="p-3 rounded-lg border border-gray-100 bg-gray-50 text-center">
                      <p className="text-xs font-medium text-gray-700">{s}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{Object.values(questionBanks[s]).reduce((a, b) => a + b.length, 0)} Qs</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ScrollArea className="max-h-[580px]">
                <div className="space-y-4 pr-4">
                  {/* Quiz Header */}
                  <div className="p-4 rounded-lg bg-gray-50 border">
                    <h3 className="font-bold text-lg text-gray-900">
                      {config.quizTitle || `${config.subject} - ${config.topic}`}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="secondary">{config.subject}</Badge>
                      <Badge variant="outline">{config.topic}</Badge>
                      <Badge variant="outline">{config.difficulty}</Badge>
                      <Badge variant="outline">{questions.length} Questions</Badge>
                    </div>
                  </div>

                  {/* Questions */}
                  {questions.map((q, idx) => (
                    <div key={q.id} className={`p-4 rounded-lg border ${q.isEdited ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 text-sm font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <Badge variant="secondary" className="text-[11px]">
                            {q.type === 'multiple-choice' ? 'Multiple Choice' : q.type === 'true-false' ? 'True / False' : 'Short Answer'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {q.isEdited && (
                            <Badge className="text-[11px] bg-blue-100 text-blue-700">Edited</Badge>
                          )}
                          {editingId !== q.id ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 text-gray-400 hover:text-gray-600"
                              onClick={() => handleEditQuestion(q)}
                            >
                              Edit
                            </Button>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-green-600 hover:text-green-700"
                                onClick={handleSaveEdit}
                              >
                                Save
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-gray-400 hover:text-gray-600"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {editingId === q.id ? (
                        <div className="space-y-3 mt-2 pl-9">
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Question Text</label>
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                          {q.type === 'multiple-choice' && (
                            <div>
                              <label className="text-xs font-medium text-gray-500 mb-1 block">Options</label>
                              {editOptions.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2 mb-1.5">
                                  <span className="text-xs font-medium text-gray-400 w-5">{String.fromCharCode(65 + oi)}.</span>
                                  <Input
                                    value={opt}
                                    onChange={(e) => updateOption(oi, e.target.value)}
                                    className="text-sm h-8"
                                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                                    onClick={() => removeOption(oi)}
                                    disabled={editOptions.length <= 2}
                                  >
                                    ×
                                  </Button>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 mt-1"
                                onClick={addCustomOption}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Option
                              </Button>
                            </div>
                          )}
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Correct Answer</label>
                            <Input
                              value={editAnswer}
                              onChange={(e) => setEditAnswer(e.target.value)}
                              className="text-sm"
                              placeholder="Enter correct answer"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-800 font-medium pl-9">{q.text}</p>

                          {q.options && (
                            <div className="space-y-1.5 mt-3 pl-9">
                              {q.options.map((opt, oi) => {
                                const isCorrect = showAnswers && opt === q.correctAnswer;
                                return (
                                  <div
                                    key={oi}
                                    className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md ${
                                      isCorrect ? 'bg-emerald-100 border border-emerald-200' : 'bg-gray-50 border border-gray-100'
                                    }`}
                                  >
                                    <span className={`font-medium text-xs ${isCorrect ? 'text-emerald-700' : 'text-gray-400'}`}>
                                      {String.fromCharCode(65 + oi)}.
                                    </span>
                                    <span className={isCorrect ? 'text-emerald-800 font-medium' : 'text-gray-700'}>{opt}</span>
                                    {isCorrect && <CheckCircle className="h-3.5 w-3.5 text-emerald-600 ml-auto" />}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {showAnswers && (
                            <div className={`mt-3 pl-9 flex items-center gap-2 text-sm ${q.type !== 'multiple-choice' ? '' : ''}`}>
                              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span className="text-emerald-800">
                                {q.type === 'multiple-choice' ? 'Answer: ' : ''}
                                <strong>{q.correctAnswer}</strong>
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}

                  {/* Action Buttons */}
                  <Separator />
                  <div className="flex flex-wrap gap-3 justify-center pt-2">
                    <Button onClick={handleSaveQuiz} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <Download className="h-4 w-4" />
                      Save Quiz
                    </Button>
                    <Button onClick={handlePrintQuiz} variant="outline" className="gap-2">
                      <Printer className="h-4 w-4" />
                      Print Quiz
                    </Button>
                    <Button onClick={handleCopyQuiz} variant="outline" className="gap-2">
                      <Copy className="h-4 w-4" />
                      Copy to Clipboard
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
