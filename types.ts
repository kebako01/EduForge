
// 1. Core Enums
export enum BlockType {
    TEXT = 'text',
    MCQ = 'mcq',
    INPUT = 'input',
    MATH = 'math',
    CANVAS = 'canvas',
    SORT = 'sort',
    MATCH = 'match',
    HABIT = 'habit', // NEW: Life as a Block
    TASK = 'task',   // NEW: Project Management
    SOCRATIC = 'socratic', // NEW: Open-ended text evaluation
    CODE = 'code', // NEW: Syntax Highlighting
    DIAGRAM = 'diagram', // NEW: Mermaid Diagrams
    CHART = 'chart', // NEW: Recharts Data Visualization
    COURSE_MAP = 'course_map', // NEW: Brilliant-style Course Structure
    UNKNOWN = 'unknown'
}

// 2. SRS (Spaced Repetition System) Data
export interface SRSData {
    entityId: string; 
    repetitionCount: number;
    stability: number; 
    difficulty: number; 
    level: number; 
    integratedLevels?: number[]; 
    name?: string; 
    objective?: string; 
    lastReviewed?: number; 
    nextReviewDue?: number; 
    masteryScore: number; 
}

// 3. Block State (UI Persistence)
export interface BlockState {
    status: 'idle' | 'correct' | 'incorrect' | 'revealed';
    attempts: number;
    // Type-specific state persistence
    selection?: string; 
    inputValue?: string; 
    lastInteractionAt?: number;
    // NEW: State for complex blocks
    sortOrder?: string[]; 
    matches?: Record<string, string>; 
    // NEW: Habit/Task state
    isCompletedToday?: boolean;
    completedDate?: number;
    // NEW: Socratic state
    socraticInput?: string;
}

// 4. Block Data Structures
export interface BlockBase {
    id: string;
    type: BlockType;
    srs?: SRSData; 
    variations?: Block[]; 
    state?: BlockState;
    hints?: string[]; 
    explanationSteps?: { title: string; content: string }[]; 
}

export interface TextBlock extends BlockBase {
    type: BlockType.TEXT;
    content: string; 
    variant: 'paragraph' | 'heading' | 'quote' | 'callout';
}

export interface MCQOption {
    id: string;
    text: string;
    isCorrect: boolean;
    feedback?: string;
}

export interface MCQBlock extends BlockBase {
    type: BlockType.MCQ;
    question: string;
    options: MCQOption[];
    explanation?: string; 
}

export interface InputBlock extends BlockBase {
    type: BlockType.INPUT;
    prompt: string;
    correctAnswer: string[]; 
    placeholder?: string;
    caseSensitive?: boolean;
}

export interface MathBlock extends BlockBase {
    type: BlockType.MATH;
    latex: string;
    description?: string;
    isInteractive?: boolean; 
}

export interface CanvasBlock extends BlockBase {
    type: BlockType.CANVAS;
    initialData?: string; 
    instruction: string;
}

export interface SortItem {
    id: string;
    text: string;
}

export interface SortBlock extends BlockBase {
    type: BlockType.SORT;
    prompt: string;
    items: SortItem[]; 
    correctOrder: string[]; 
}

export interface MatchPair {
    left: { id: string; text: string };
    right: { id: string; text: string };
}

export interface MatchBlock extends BlockBase {
    type: BlockType.MATCH;
    prompt: string;
    pairs: MatchPair[]; 
}

// --- NEW BLOCKS: LIFE FORGE ---

export interface HabitBlock extends BlockBase {
    type: BlockType.HABIT;
    prompt: string; // The habit name
    frequency: 'daily' | 'weekly';
    streak: number;
    history: number[]; // Array of timestamps when completed
}

export interface TaskBlock extends BlockBase {
    type: BlockType.TASK;
    content: string; // The task description
    isCompleted: boolean;
    dueDate?: number; // Timestamp
    priority?: 'low' | 'medium' | 'high';
}

// --- NEW BLOCK: SOCRATIC (The Intelligent Grader) ---

export interface SocraticCriteria {
    id: string;
    label: string; // e.g. "Uses Thermodynamics First Law"
    // Validation Logic
    requiredKeywords?: string[]; // Arrays allow synonyms: ["energy conserved", "no energy lost"]
    forbiddenKeywords?: string[]; // Detect common misconceptions: ["energy created"]
    minLength?: number; // Ensure depth
    // Feedback
    feedbackPass: string;
    feedbackFail: string;
}

export interface SocraticBlock extends BlockBase {
    type: BlockType.SOCRATIC;
    prompt: string;
    placeholder?: string;
    minScoreToPass: number; // e.g. 2 out of 3 criteria met
    rubric: SocraticCriteria[];
}

// --- NEW BLOCK: CODE (Syntax Highlighter) ---
export interface CodeBlock extends BlockBase {
    type: BlockType.CODE;
    language: string; // e.g. 'javascript', 'python', 'rust'
    code: string;
    caption?: string;
}

// --- NEW BLOCK: DIAGRAM (Mermaid) ---
export interface DiagramBlock extends BlockBase {
    type: BlockType.DIAGRAM;
    chart: string; // The Mermaid Syntax
    caption?: string;
}

// --- NEW BLOCK: CHART (Recharts) ---
export interface ChartDataPoint {
    name: string | number;
    [key: string]: string | number;
}

export interface ChartSeries {
    dataKey: string;
    color: string;
    name?: string; // Legend label
}

export interface ChartBlock extends BlockBase {
    type: BlockType.CHART;
    chartType: 'line' | 'bar' | 'area' | 'pie';
    title?: string;
    xAxisKey: string; // The key in data objects to use for X Axis
    data: ChartDataPoint[];
    series: ChartSeries[]; // What to plot
}

// --- NEW BLOCK: COURSE MAP (Brilliant-style Structure) ---
export interface CourseNode {
    id: string;
    title: string;
    description: string;
    targetPageId: string; // The ID of the page this node opens (exists or not)
    levelIndex: number; // Which level group does this belong to?
    icon?: 'search' | 'math' | 'code' | 'atom' | 'book';
}

export interface CourseLevel {
    index: number;
    title: string;
    description?: string;
}

export interface CourseMapBlock extends BlockBase {
    type: BlockType.COURSE_MAP;
    courseTitle: string;
    courseDescription: string;
    levels: CourseLevel[];
    nodes: CourseNode[];
}

// Union Type
export type Block = TextBlock | MCQBlock | InputBlock | MathBlock | CanvasBlock | SortBlock | MatchBlock | HabitBlock | TaskBlock | SocraticBlock | CodeBlock | DiagramBlock | ChartBlock | CourseMapBlock;

// --- PAGE RECS ---
export interface PageRecommendation {
    id: string;
    title: string;
    type: string; // Flexible type (e.g. 'practice', 'next', 'history', 'project')
    context: string; // The context to pass to AI Architect
}

// --- NEW: PAGE LIFECYCLE (FSRS + EVOLUTION) ---
export interface PageCycle {
    status: 'active' | 'locked' | 'retrieval_pending'; // locked = incubation, retrieval_pending = gatekeeper
    chapter: number; // Iteration count (Chapter 1 = base, Chapter 2 = first evolution)
    nextReview: number; // Timestamp when lock expires
    lastRetrieval?: string; // The text user typed to pass the gate
}

// 5. Page Structure
export interface Page {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    blocks: Block[]; 
    tags?: string[];
    recommendations?: PageRecommendation[]; // AI suggested next steps
    cycle?: PageCycle; // NEW: Page Lifecycle Management
}

// --- NEW: REAL TIME TELEMETRY ---
export interface StudyCheckpoint {
    blockId: string;
    blockType: BlockType;
    timestamp: number; // When completed
    timeOffset: number; // Seconds since session start
}

export interface StudySession {
    id: string;
    pageId: string;
    pageTitle: string;
    startTime: number;
    endTime: number;
    durationSeconds: number;
    checkpoints: StudyCheckpoint[];
    isComplete: boolean; // Did they reach the end/victory?
}

// --- NEW: AI STRATEGY TYPES ---
export interface StrategicMission {
    title: string;
    type: 'REPAIR' | 'EVOLUTION' | 'SYNTHESIS';
    reason: string;
    targetBlockIds: string[];
}
