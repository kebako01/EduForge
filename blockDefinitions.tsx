
import React from 'react';
import { 
    Block, 
    BlockType, 
    TextBlock, 
    MCQBlock, 
    MathBlock, 
    InputBlock, 
    CanvasBlock, 
    SortBlock, 
    MatchBlock,
    HabitBlock,
    TaskBlock,
    SocraticBlock,
    CodeBlock,
    DiagramBlock,
    ChartBlock,
    CourseMapBlock
} from './types';
import { 
    TextBlockRenderer, 
    MCQBlockRenderer, 
    MathBlockRenderer, 
    InputBlockRenderer, 
    CanvasBlockRenderer,
    SortBlockRenderer,
    MatchBlockRenderer,
    HabitBlockRenderer,
    TaskBlockRenderer,
    SocraticBlockRenderer,
    CodeBlockRenderer,
    DiagramBlockRenderer,
    ChartBlockRenderer,
    CourseMapBlockRenderer
} from './components/BlockComponents';

// Definition Interface Enhanced for AI
interface BlockDefinition<T extends Block> {
    type: BlockType;
    // UI Logic
    sanitize: (raw: any) => T; 
    Component: React.FC<{ data: T; pageId?: string; onAutoCreate?: (topic: string, context: string, blueprint?: string) => void }>;
    // AI Logic (The "Self-Description")
    promptSchema: string; 
}

class Registry {
    private definitions: Map<BlockType, BlockDefinition<any>> = new Map();

    register<T extends Block>(def: BlockDefinition<T>) {
        this.definitions.set(def.type, def);
    }

    get(type: BlockType): BlockDefinition<any> | undefined {
        return this.definitions.get(type);
    }

    // Dynamic AI Prompt Generator
    generatePromptSchema(): string {
        let schema = "TYPE DEFINITIONS (Strict JSON Format):\n\n";
        let counter = 1;
        this.definitions.forEach((def) => {
            schema += `${counter}. ${def.promptSchema}\n`;
            counter++;
        });
        
        schema += `
CRITICAL RULES:
- Output MUST be a valid JSON Object.
- Do NOT generate markdown code fences around the JSON. Return raw JSON.
- Use "entityId" in SRS blocks. This ID MUST persist across evolutions.
- "name" and "objective" in SRS should reflect the specific Level difficulty.
- ALWAYS include "hints" and "explanationSteps" for interactive blocks. "explanationSteps" is MANDATORY.
`;
        return schema;
    }
}

export const blockRegistry = new Registry();

// Helper to sanitize variations recursively 
const sanitizeVariations = (rawVariations: any): Block[] | undefined => {
    if (!Array.isArray(rawVariations)) return undefined;
    return rawVariations.filter(v => v && typeof v === 'object' && v.type);
};

// Helper to pass state safely
const passState = (raw: any) => raw.state ? {
    status: raw.state.status || 'idle',
    attempts: typeof raw.state.attempts === 'number' ? raw.state.attempts : 0,
    selection: raw.state.selection,
    inputValue: raw.state.inputValue,
    lastInteractionAt: raw.state.lastInteractionAt,
    sortOrder: Array.isArray(raw.state.sortOrder) ? raw.state.sortOrder : undefined,
    matches: typeof raw.state.matches === 'object' ? raw.state.matches : undefined,
    socraticInput: raw.state.socraticInput
} : undefined;

// --- Registration ---

// 1. Text
blockRegistry.register<TextBlock>({
    type: BlockType.TEXT,
    promptSchema: `TextBlock: { "type": "text", "variant": "paragraph" | "heading" | "quote" | "callout", "content": "markdown string" }`,
    sanitize: (raw: any) => {
        if (!raw.content) throw new Error("Text block missing 'content'");
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.TEXT,
            content: String(raw.content),
            variant: ['paragraph', 'heading', 'quote', 'callout'].includes(raw.variant) ? raw.variant : 'paragraph',
            variations: sanitizeVariations(raw.variations),
            state: passState(raw),
            srs: raw.srs 
        };
    },
    Component: TextBlockRenderer
});

// 2. MCQ
blockRegistry.register<MCQBlock>({
    type: BlockType.MCQ,
    promptSchema: `MCQBlock: { 
    "type": "mcq", 
    "question": "markdown string", 
    "options": [{ "id": "opt-1", "text": "...", "isCorrect": boolean, "feedback": "optional string" }],
    "hints": ["Hint 1", "Hint 2"],
    "explanationSteps": [ { "title": "Concept", "content": "..." }, { "title": "Application", "content": "..." } ],
    "srs": {
        "entityId": "string (PERSISTENT)",
        "level": number,
        "integratedLevels": [number],
        "name": "string (REQUIRED: Short Topic Category in UPPERCASE)",
        "objective": "string (REQUIRED: The specific learning goal)"
    }
   }`,
    sanitize: (raw: any) => {
        if (!raw.question) throw new Error("MCQ missing 'question'");
        if (!Array.isArray(raw.options) || raw.options.length === 0) throw new Error("MCQ missing 'options'");
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.MCQ,
            question: String(raw.question),
            options: raw.options.map((o: any, idx: number) => ({
                id: o.id || `opt-${idx}`,
                text: String(o.text),
                isCorrect: Boolean(o.isCorrect),
                feedback: o.feedback ? String(o.feedback) : undefined
            })),
            explanation: raw.explanation ? String(raw.explanation) : undefined,
            hints: Array.isArray(raw.hints) ? raw.hints : undefined,
            explanationSteps: Array.isArray(raw.explanationSteps) ? raw.explanationSteps : undefined,
            srs: raw.srs, 
            variations: sanitizeVariations(raw.variations),
            state: passState(raw)
        };
    },
    Component: MCQBlockRenderer
});

// 3. Math
blockRegistry.register<MathBlock>({
    type: BlockType.MATH,
    promptSchema: `MathBlock: { "type": "math", "latex": "latex string", "description": "optional string" }`,
    sanitize: (raw: any) => {
        if (!raw.latex) throw new Error("Math block missing 'latex'");
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.MATH,
            latex: String(raw.latex),
            description: raw.description,
            isInteractive: raw.isInteractive,
            hints: Array.isArray(raw.hints) ? raw.hints : undefined,
            explanationSteps: Array.isArray(raw.explanationSteps) ? raw.explanationSteps : undefined,
            srs: raw.srs, 
            variations: sanitizeVariations(raw.variations),
            state: passState(raw)
        };
    },
    Component: MathBlockRenderer
});

// 4. Input
blockRegistry.register<InputBlock>({
    type: BlockType.INPUT,
    promptSchema: `InputBlock: { 
    "type": "input", 
    "prompt": "question string", 
    "correctAnswer": ["exact answer 1", "exact answer 2"], 
    "hints": ["Hint 1"],
    "explanationSteps": [ { "title": "Strategy", "content": "..." } ],
    "srs": {
        "entityId": "string (PERSISTENT)",
        "level": number,
        "name": "string (REQUIRED: Short Topic Category)",
        "objective": "string (REQUIRED: The learning goal)"
    }
   }`,
    sanitize: (raw: any) => {
        if (!raw.prompt) throw new Error("Input block missing 'prompt'");
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.INPUT,
            prompt: String(raw.prompt),
            correctAnswer: Array.isArray(raw.correctAnswer) ? raw.correctAnswer : [],
            placeholder: raw.placeholder,
            hints: Array.isArray(raw.hints) ? raw.hints : undefined,
            explanationSteps: Array.isArray(raw.explanationSteps) ? raw.explanationSteps : undefined,
            srs: raw.srs, 
            variations: sanitizeVariations(raw.variations),
            state: passState(raw)
        };
    },
    Component: InputBlockRenderer
});

// 5. Canvas
blockRegistry.register<CanvasBlock>({
    type: BlockType.CANVAS,
    promptSchema: `CanvasBlock: { "type": "canvas", "instruction": "string" }`,
    sanitize: (raw: any) => {
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.CANVAS,
            instruction: raw.instruction || "Draw here",
            initialData: raw.initialData,
            srs: raw.srs, 
            variations: sanitizeVariations(raw.variations),
            state: passState(raw)
        };
    },
    Component: CanvasBlockRenderer
});

// 6. Sort
blockRegistry.register<SortBlock>({
    type: BlockType.SORT,
    promptSchema: `SortBlock: { 
        "type": "sort", 
        "prompt": "markdown string",
        "items": [{ "id": "1", "text": "First" }, { "id": "2", "text": "Second" }],
        "correctOrder": ["1", "2"],
        "hints": ["Hint"],
        "explanationSteps": [ { "title": "Logic", "content": "..." } ],
        "srs": { ...standard SRS fields... }
    }`,
    sanitize: (raw: any) => {
        if (!raw.prompt) throw new Error("Sort block missing 'prompt'");
        if (!Array.isArray(raw.items)) throw new Error("Sort block missing 'items'");
        if (!Array.isArray(raw.correctOrder)) throw new Error("Sort block missing 'correctOrder'");
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.SORT,
            prompt: String(raw.prompt),
            items: raw.items.map((i: any) => ({ id: String(i.id), text: String(i.text) })),
            correctOrder: raw.correctOrder.map(String),
            hints: Array.isArray(raw.hints) ? raw.hints : undefined,
            explanationSteps: Array.isArray(raw.explanationSteps) ? raw.explanationSteps : undefined,
            srs: raw.srs, 
            variations: sanitizeVariations(raw.variations),
            state: passState(raw)
        };
    },
    Component: SortBlockRenderer
});

// 7. Match
blockRegistry.register<MatchBlock>({
    type: BlockType.MATCH,
    promptSchema: `MatchBlock: {
        "type": "match",
        "prompt": "markdown string",
        "pairs": [ { "left": {"id": "a", "text": "A"}, "right": {"id": "b", "text": "B"} } ],
        "hints": ["Hint"],
        "explanationSteps": [ { "title": "Connections", "content": "..." } ],
        "srs": { ...standard SRS fields... }
    }`,
    sanitize: (raw: any) => {
        if (!raw.prompt) throw new Error("Match block missing 'prompt'");
        if (!Array.isArray(raw.pairs)) throw new Error("Match block missing 'pairs'");
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.MATCH,
            prompt: String(raw.prompt),
            pairs: raw.pairs.map((p: any) => ({
                left: { id: String(p.left.id), text: String(p.left.text) },
                right: { id: String(p.right.id), text: String(p.right.text) }
            })),
            hints: Array.isArray(raw.hints) ? raw.hints : undefined,
            explanationSteps: Array.isArray(raw.explanationSteps) ? raw.explanationSteps : undefined,
            srs: raw.srs, 
            variations: sanitizeVariations(raw.variations),
            state: passState(raw)
        };
    },
    Component: MatchBlockRenderer
});

// 8. Habit (NEW)
blockRegistry.register<HabitBlock>({
    type: BlockType.HABIT,
    promptSchema: `HabitBlock: {
        "type": "habit",
        "prompt": "Habit Name (e.g. Morning Jog)",
        "frequency": "daily" | "weekly"
    }`,
    sanitize: (raw: any) => {
        if (!raw.prompt) throw new Error("Habit missing 'prompt'");
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.HABIT,
            prompt: String(raw.prompt),
            frequency: raw.frequency === 'weekly' ? 'weekly' : 'daily',
            streak: typeof raw.streak === 'number' ? raw.streak : 0,
            history: Array.isArray(raw.history) ? raw.history : [],
            variations: sanitizeVariations(raw.variations),
            state: passState(raw)
        };
    },
    Component: HabitBlockRenderer
});

// 9. Task (NEW)
blockRegistry.register<TaskBlock>({
    type: BlockType.TASK,
    promptSchema: `TaskBlock: {
        "type": "task",
        "content": "Task description",
        "isCompleted": boolean,
        "dueDate": number (timestamp, optional)
    }`,
    sanitize: (raw: any) => {
        if (!raw.content) throw new Error("Task missing 'content'");
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.TASK,
            content: String(raw.content),
            isCompleted: Boolean(raw.isCompleted),
            dueDate: typeof raw.dueDate === 'number' ? raw.dueDate : undefined,
            priority: raw.priority,
            variations: sanitizeVariations(raw.variations),
            state: passState(raw)
        };
    },
    Component: TaskBlockRenderer
});

// 10. SOCRATIC BLOCK (The Grader)
blockRegistry.register<SocraticBlock>({
    type: BlockType.SOCRATIC,
    promptSchema: `SocraticBlock: {
        "type": "socratic",
        "prompt": "string (Open ended question)",
        "placeholder": "string (UI hint)",
        "minScoreToPass": number (Integer, e.g. 2),
        "rubric": [
            {
                "id": "c1",
                "label": "string (Criteria Name, e.g. 'Mentions Conservation of Energy')",
                "requiredKeywords": ["string", "string"] (Synonyms allowed),
                "forbiddenKeywords": ["string"] (Common misconceptions),
                "minLength": number (optional),
                "feedbackPass": "string (Specific praise)",
                "feedbackFail": "string (Specific guidance)"
            }
        ],
        "hints": ["Hint"],
        "explanationSteps": [ { "title": "Ideal Answer", "content": "..." } ],
        "srs": { ... }
    }`,
    sanitize: (raw: any) => {
        if (!raw.prompt) throw new Error("Socratic block missing 'prompt'");
        if (!Array.isArray(raw.rubric)) throw new Error("Socratic block missing 'rubric'");
        
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.SOCRATIC,
            prompt: String(raw.prompt),
            placeholder: raw.placeholder,
            minScoreToPass: typeof raw.minScoreToPass === 'number' ? raw.minScoreToPass : 1,
            rubric: raw.rubric.map((c: any) => ({
                id: c.id || crypto.randomUUID(),
                label: String(c.label),
                requiredKeywords: Array.isArray(c.requiredKeywords) ? c.requiredKeywords : [],
                forbiddenKeywords: Array.isArray(c.forbiddenKeywords) ? c.forbiddenKeywords : [],
                minLength: typeof c.minLength === 'number' ? c.minLength : 0,
                feedbackPass: String(c.feedbackPass),
                feedbackFail: String(c.feedbackFail)
            })),
            hints: Array.isArray(raw.hints) ? raw.hints : undefined,
            explanationSteps: Array.isArray(raw.explanationSteps) ? raw.explanationSteps : undefined,
            srs: raw.srs, 
            variations: sanitizeVariations(raw.variations),
            state: passState(raw)
        };
    },
    Component: SocraticBlockRenderer
});

// 11. CODE BLOCK (Syntax Highlighting)
blockRegistry.register<CodeBlock>({
    type: BlockType.CODE,
    promptSchema: `CodeBlock: { "type": "code", "language": "javascript|python|rust|etc", "code": "string", "caption": "optional string" }`,
    sanitize: (raw: any) => {
        if (!raw.code) throw new Error("Code block missing 'code'");
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.CODE,
            language: raw.language || 'text',
            code: String(raw.code),
            caption: raw.caption,
            variations: sanitizeVariations(raw.variations),
            state: passState(raw),
            srs: raw.srs 
        };
    },
    Component: CodeBlockRenderer
});

// 12. DIAGRAM BLOCK (Mermaid)
blockRegistry.register<DiagramBlock>({
    type: BlockType.DIAGRAM,
    promptSchema: `DiagramBlock: { 
        "type": "diagram", 
        "chart": "string (Mermaid syntax. CRITICAL: Wrap ALL node labels in double quotes. e.g. A[\\"Label (x)\\"] not A[Label (x)].)", 
        "caption": "optional string" 
    }`,
    sanitize: (raw: any) => {
        if (!raw.chart) throw new Error("Diagram block missing 'chart'");
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.DIAGRAM,
            chart: String(raw.chart),
            caption: raw.caption,
            variations: sanitizeVariations(raw.variations),
            state: passState(raw),
            srs: raw.srs 
        };
    },
    Component: DiagramBlockRenderer
});

// 13. CHART BLOCK (Recharts)
blockRegistry.register<ChartBlock>({
    type: BlockType.CHART,
    promptSchema: `ChartBlock: { 
        "type": "chart", 
        "chartType": "line" | "bar" | "area" | "pie",
        "title": "optional string",
        "xAxisKey": "name (key in data object)",
        "data": [ { "name": "Jan", "value": 400 }, { "name": "Feb", "value": 300 } ],
        "series": [ { "dataKey": "value", "color": "#8884d8", "name": "Sales" } ]
    }`,
    sanitize: (raw: any) => {
        if (!raw.data || !Array.isArray(raw.data)) throw new Error("Chart block missing 'data' array");
        if (!raw.series || !Array.isArray(raw.series)) throw new Error("Chart block missing 'series' configuration");
        
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.CHART,
            chartType: ['line', 'bar', 'area', 'pie'].includes(raw.chartType) ? raw.chartType : 'line',
            title: raw.title,
            xAxisKey: raw.xAxisKey || 'name',
            data: raw.data,
            series: raw.series.map((s: any) => ({
                dataKey: String(s.dataKey),
                color: String(s.color || '#6366f1'),
                name: s.name
            })),
            variations: sanitizeVariations(raw.variations),
            state: passState(raw),
            srs: raw.srs 
        };
    },
    Component: ChartBlockRenderer
});

// 14. COURSE MAP (Brilliant-style Curriculum)
blockRegistry.register<CourseMapBlock>({
    type: BlockType.COURSE_MAP,
    promptSchema: `CourseMapBlock: { 
        "type": "course_map", 
        "courseTitle": "Course Name",
        "courseDescription": "Overview",
        "levels": [ { "index": 1, "title": "Level 1" } ],
        "nodes": [ { "id": "n1", "title": "Lesson 1", "description": "Desc", "targetPageId": "uuid-or-placeholder", "levelIndex": 1, "icon": "book|search|math|code|atom" } ]
    }`,
    sanitize: (raw: any) => {
        if (!raw.levels || !Array.isArray(raw.levels)) throw new Error("Course Map missing 'levels'");
        if (!raw.nodes || !Array.isArray(raw.nodes)) throw new Error("Course Map missing 'nodes'");
        
        return {
            id: raw.id || crypto.randomUUID(),
            type: BlockType.COURSE_MAP,
            courseTitle: String(raw.courseTitle || "Course Roadmap"),
            courseDescription: String(raw.courseDescription || ""),
            levels: raw.levels.map((l: any) => ({
                index: typeof l.index === 'number' ? l.index : 1,
                title: String(l.title),
                description: l.description
            })),
            nodes: raw.nodes.map((n: any) => ({
                id: String(n.id),
                title: String(n.title),
                description: String(n.description),
                targetPageId: String(n.targetPageId),
                levelIndex: typeof n.levelIndex === 'number' ? n.levelIndex : 1,
                icon: n.icon
            })),
            variations: sanitizeVariations(raw.variations),
            state: passState(raw),
            srs: raw.srs 
        };
    },
    Component: CourseMapBlockRenderer
});
