
import { Block, SRSData } from '../types';
import { blockRegistry } from '../blockDefinitions';

export class SystemContextLoader {

    /**
     * --- ARCHITECTURE CORE: THE SOURCE OF TRUTH ---
     * This defines the rigorous JSON structure for ANY Page created in the system.
     * By centralizing this, we ensure every single generated page (Mission, Synthesis, Lesson)
     * automatically includes the 'recommendations' engine and adheres to the format.
     */
    private static get GLOBAL_PAGE_SCHEMA(): string {
        return `
OUTPUT FORMAT (STRICT JSON OBJECT):
{
  "title": "Compelling Title String",
  "tags": ["Domain", "Sub-Domain", "Specific Topic"],
  "recommendations": [
    {
      "id": "rec_1 (use random string)",
      "title": "Title of the suggested next lesson",
      "type": "practice" | "deep-dive" | "project" | "connection",
      "context": "One sentence explaining WHY the student should go here next (e.g. 'To practice the concept of friction you just learned')."
    },
    { ... (Generate exactly 3 diverse recommendations) ... }
  ],
  "blocks": [ 
    ... (The Array of Blocks generated based on the Type Definitions above) ... 
  ]
}

CRITICAL STRUCTURAL RULES:
1. **MANDATORY RECOMMENDATIONS:** You MUST include the "recommendations" array. This is the navigation engine of the app. Never output a page without it.
2. **NO MARKDOWN:** Return raw JSON. Do not wrap in \`\`\`json ... \`\`\`.
`;
    }
    
    /**
     * PHASE 1: THE STRATEGIST
     * Takes raw inventory of blocks and asks AI to group them into cohesive missions.
     */
    static generateStrategicPlanPrompt(overdueItems: { pageTitle: string; block: Block }[]): string {
        const inventory = overdueItems.map(item => {
            const b = item.block;
            return `- ID: "${b.srs?.entityId || b.id}" | Name: "${b.srs?.name || 'Unknown'}" | Context: "${item.pageTitle}" | Current Lvl: ${b.srs?.level || 1} | Stability: ${b.srs?.stability?.toFixed(1) || 0} days`;
        }).join('\n');

        return `
ROLE: You are the "Grand Strategist" of a super-learning system.
TASK: Analyze the user's fragmented knowledge inventory (decaying concepts) and group them into 3-5 cohesive "Learning Missions" (Review Sessions).

INVENTORY OF DECAYING CONCEPTS:
${inventory}

STRATEGY RULES:
1. **Don't just group by tag.** Look for deep semantic connections.
   - *Example:* Group "Physics: Friction" and "Math: Integrals" into a "Applied Calculus" mission.
2. **Prioritize Transfer Learning.** Create at least one mission that mixes concepts from different domains if possible.
3. **Handle Orphans.** If a concept fits nowhere, ignore it for now (do not force it).
4. **Mission Types:**
   - "REPAIR": For concepts with low stability (< 2 days).
   - "EVOLUTION": For stable concepts ready for Level +1 complexity.
   - "SYNTHESIS": For connecting multiple domains.

OUTPUT FORMAT (Strict JSON Array of Objects):
[
  {
    "title": "Mission Title (e.g. 'Thermodynamics Repair')",
    "type": "REPAIR" | "EVOLUTION" | "SYNTHESIS",
    "reason": "Brief explanation of why these blocks were grouped.",
    "targetBlockIds": ["ID_1", "ID_2"] // The exact IDs from the inventory list above
  },
  ...
]
`.trim();
    }

    /**
     * PHASE 2: THE TACTICIAN (Page Generator)
     * Generates the actual content for a specific mission.
     */
    static generateReviewSessionPrompt(cluster: { topic: string, items: any[], strategy: string, reason?: string }): string {
        const dslSchema = blockRegistry.generatePromptSchema();
        
        const conceptList = cluster.items.map(i => {
            const b = i.block;
            return `- Name: ${b.srs?.name || b.srs?.entityId}, ID: ${b.srs?.entityId}, Current Level: ${b.srs?.level}`;
        }).join('\n');

        return `
ROLE: You are a High-Tier Learning Architect.
TASK: Execute the Strategic Mission: "${cluster.topic}".
STRATEGY: ${cluster.strategy}
CONTEXT: ${cluster.reason || 'Consolidate knowledge.'}

TACTICAL UNITS (Concepts to Deploy):
${conceptList}

PEDAGOGICAL CONSTRAINT: THE ANTI-SPOILER PROTOCOL (STRICT):
- **NO SELF-SPOILERS:** You are strictly forbidden from revealing the specific answer to a question in the text block immediately preceding it.
- **PRINCIPLE VS APPLICATION:** The text block should explain the *principle* or general rule. The interactive block must ask for a specific *application* or *edge case* that requires thinking.
- **FAILURE EXAMPLE:** Text: "The capital of France is Paris." -> Question: "What is the capital of France?". (THIS IS BANNED).
- **SUCCESS EXAMPLE:** Text: "European capitals often developed around major rivers for trade defense." -> Question: "Locate Paris on the map relative to the Seine".

CRITICAL MISSION OBJECTIVES:
1. **Transfer Learning (Crucial):** Do NOT just ask 1 question per concept in isolation. You MUST create compound problems that require using at least 2 of these concepts simultaneously to solve.
   - Example: If inputs are "Kinetic Energy" and "Friction", ask a question about a sliding object stopping distance (combining both).
2. **Narrative Flow:** The session should feel like a cohesive mission, not a random list. Use a consistent theme or scenario.
3. **SRS Integrity:**
   - For every block, you MUST map it to one of the "ID"s listed above in the "srs.entityId" field.
   - If a block combines multiple concepts, pick the primary one as "entityId" and list the others in "srs.integratedLevels" or explain in feedback.

${dslSchema}

${SystemContextLoader.GLOBAL_PAGE_SCHEMA}
`.trim();
    }

    /**
     * GENERIC PAGE PROMPT (Standard)
     */
    static generatePagePrompt(topic: string, tags: string[] = [], instructions: string = ''): string {
        const tagContext = tags.length > 0 
            ? `CONTEXT TAGS (Knowledge Domain): [${tags.join(', ')}]. The content MUST fit strictly within this hierarchy.` 
            : '';
        
        const dslSchema = blockRegistry.generatePromptSchema();

        const structureDirective = instructions.trim() 
            ? `USER DESIGN BLUEPRINT (PRIMARY CONSTRAINT):
${instructions}
(You MUST structure the JSON blocks to strictly fulfill the user's specific request above. If they ask for a quiz, generate ONLY questions. If they ask for a timeline, use Text/Sort blocks.)`
            : `DEFAULT STRUCTURE:
1. Start with a Hook (Text/Heading).
2. Explain core concepts clearly (Text/Math/Diagram).
3. Interleave interactions immediately (MCQ/Input) to test understanding.
4. End with a summary.`;

        return `
ROLE: You are an expert instructional designer and subject matter expert.
TASK: Create a comprehensive active learning lesson about: "${topic}".

${tagContext}

${structureDirective}

${dslSchema}

--- CRITICAL RULES FOR GENERATION ---

1. PEDAGOGICAL CONSTRAINT: THE ANTI-SPOILER PROTOCOL
   - **ABSOLUTELY FORBIDDEN:** Do NOT write a text block that states a fact (e.g., "Mitochondria is the powerhouse") and then immediately ask a question that requires simple regurgitation ("What is the powerhouse?").
   - **THE GAP:** You must create a "Cognitive Gap". Explain the mechanism, then ask for the outcome. Or explain the components, and ask for the synthesis.
   - **STRUGGLE IS GOOD:** The user must have to PAUSE and THINK to solve the interactive block. If they can solve it by just reading the previous sentence, YOU HAVE FAILED.

2. DATABASE INTEGRITY: D.R.Y. (DON'T REPEAT YOURSELF)
   - **UNIQUE CONCEPT NAMES:** A Page MUST NOT contain multiple blocks with the exact same "srs.name" or "srs.entityId" UNLESS the "srs.level" is different.
   - **NO SPAM:** Do not create 5 blocks all named "COUNTING". This corrupts the Knowledge Graph.
   - **DISTINCT SCOPE:** If you have multiple questions about Counting, give them distinct scopes: "COUNTING_BASIC", "COUNTING_SKIP", "COUNTING_REVERSE".
   - **VERTICAL EXCEPTION:** You MAY repeat a name ONLY if it is an evolution (e.g., Block A is "GRAVITY" Lvl 1, Block B is "GRAVITY" Lvl 2).
   - **VARIATIONS:** If you want to drill the EXACT same concept at the EXACT same level multiple times, do NOT create multiple top-level blocks. Put the extra questions inside the "variations" array of the single primary block.

3. FOUNDATION VECTOR:
   - Unless explicitly requested otherwise in the blueprint, set "srs.level": 1 for all learnable items.
   - "srs.integratedLevels": [].

${SystemContextLoader.GLOBAL_PAGE_SCHEMA}
`.trim();
    }

    /**
     * CURRICULUM GENERATOR
     */
    static generateCurriculumPrompt(topic: string, tags: string[] = [], instructions: string = ''): string {
        const dslSchema = blockRegistry.generatePromptSchema();
        const tagContext = tags.length > 0 
            ? `CONTEXT DOMAIN (Root Hierarchy): [${tags.join(', ')}].` 
            : '';

        const structureDirective = instructions.trim()
            ? `USER ARCHITECTURE GOALS (STRICT):
${instructions}
(Adjust the number of Levels and Nodes to match the user's request exactly.)`
            : `DEFAULT STRUCTURE:
1. Break the topic into 3 distinct Levels.
2. Define 3-5 distinct "Nodes" (Lessons) per level.`;

        return `
ROLE: You are a University Curriculum Architect.
TASK: Design a structured "Course Map" for the topic: "${topic}".
OBJECTIVE: Create a roadmap of Levels and Lessons. Do NOT create the content of the lessons yet.

${tagContext}

INSTRUCTIONS:
1. The JSON must contain ONE 'course_map' block.
2. Each Node must have a 'targetPageId' that is a UNIQUE UUID string.
3. Add a compelling Course Title and Description.

${structureDirective}

JSON SCHEMA REFERENCE:
${dslSchema}

${SystemContextLoader.GLOBAL_PAGE_SCHEMA}
`.trim();
    }

    /**
     * FLUID MASTER
     */
    static generateExternalTutorPrompt(topic: string, currentBlocks: Block[]): string {
        const dslSchema = blockRegistry.generatePromptSchema();
        const contextSummary = currentBlocks.length > 0 
            ? `CONTEXT: The student has already created ${currentBlocks.length} blocks on this page. Do not repeat basics unless asked.`
            : `CONTEXT: This is a blank slate. Start from the beginning.`;

        return `
# 🧠 ACTIVATE PROTOCOL: FLUID MASTER v3.0 (EduForge Compatible)

You are **FLUID MASTER**, an adaptive AI tutor. I want to study the topic: "**${topic}**".

${contextSummary}

## 1. YOUR CORE BEHAVIOR (The Session)
DO NOT lecture me linearly. Select one of these strategies dynamically to start:
1. **Paradox**: Show me a contradiction in ${topic} and ask me to resolve it.
2. **Broken Artifact**: Show me a flawed example (code, equation, logic) and ask me to debug it.
3. **Prediction**: Describe a system state and ask me to predict the outcome.
4. **Inversion**: Ask me to argue *against* a common best practice in this field.

**Rules for Interaction:**
- Keep your initial response SHORT (< 150 words).
- Wait for my answer.
- If I struggle, provide a hint. If I succeed, increase complexity (Level +1).
- Be Socratic. Ask questions.

## 2. THE EXIT PROTOCOL (Crucial)
At any point, if I say "SAVE SESSION" or "I'M DONE", you must **STOP tutoring** and output a **JSON Object** representing what we learned.

This JSON will be imported into my "EduForge" app. It must follow this STRICT SCHEMA:

${dslSchema}

**JSON REQUIREMENTS:**
1. **Summary Block:** Start with a 'text' block summarizing our key insights.
2. **Flashcards (SRS):** Generate 2-3 'mcq' or 'input' blocks based on the mistakes I made or concepts I mastered during our chat.
   - **DRY RULE:** Ensure each SRS item has a distinct name unless it is a higher difficulty level of a previous one.
   - **ANTI-SPOILER:** Do not reveal the answer in the summary block if it's tested in the flashcards immediately after.
3. **Reflection:** Add a 'socratic' block asking me a final open question about the topic.

${SystemContextLoader.GLOBAL_PAGE_SCHEMA}

## 3. START NOW
Initialize the session with your chosen hook strategy for: "${topic}".
`.trim();
    }

    /**
     * VARIATION
     */
    static generateVariationPrompt(block: Block, count: number = 1): string {
        const level = block.srs?.level || 1;
        const entityId = block.srs?.entityId || "new.concept";
        const dslSchema = blockRegistry.generatePromptSchema();

        return `
ROLE: You are an expert tutor specializing in Active Learning variations.
TASK: Create ${count} Distinct Lateral Variation(s) for the block below.
CONSTRAINT: 
1. Keep the SAME difficulty (Level ${level}).
2. Keep the SAME "entityId" (${entityId}).
3. Keep the SAME "name" and "objective".
OBJECTIVE: Test the same concept but with different phrasing, numbers, or context. Do not make the question identical.

SOURCE BLOCK:
${JSON.stringify(block)}

${dslSchema}

OUTPUT FORMAT:
Return a JSON Object containing an array of blocks:
{
  "blocks": [ ...Array of ${count} Block Objects... ]
}
`.trim();
    }

    /**
     * EVOLUTION
     */
    static generateEvolutionPrompt(block: Block, currentMaxLevel: number, count: number = 1): string {
        const entityId = block.srs?.entityId;
        const dslSchema = blockRegistry.generatePromptSchema();
        
        const existingLevels = [block.srs?.level, ...(block.variations?.map(v => v.srs?.level) || [])]
            .filter(l => l !== undefined)
            .map(Number)
            .sort((a,b) => a - b);
        
        const distinctLevels = [...new Set(existingLevels)];
        const targetLevel = currentMaxLevel + 1;

        return `
ROLE: You are an Adaptive Learning Architect.
TASK: Evolve the concept "${entityId}" from Level ${currentMaxLevel} to Level ${targetLevel}.
QUANTITY: Synthesize ${count} distinct variation(s).

GENETIC HISTORY (Existing Levels): [${distinctLevels.join(', ')}]

STRATEGY (The Vector of Integration):
You are creating a "Compound Exercise".
1. Target Difficulty: Level ${targetLevel}.
2. Interleaving: The new exercise MUST explicitly combine skills from previous levels.
3. EXPLICIT DEPENDENCIES: In the JSON "srs.integratedLevels", you MUST list exactly which previous levels are required to solve this new problem (e.g., [1, 2] means it uses Lvl 1 and 2 mechanics).

CRITICAL JSON REQUIREMENTS:
1. "srs.entityId" MUST be exactly "${entityId}".
2. "srs.level" MUST be ${targetLevel}.
3. "srs.integratedLevels" MUST be an array of numbers representing the ingredients used.
4. "srs.name": Give it a name that implies integration.
5. "srs.objective": "Apply [Level X] and [Level Y] to solve [Scenario]".

${dslSchema}

OUTPUT FORMAT:
Return a JSON Object containing an array of blocks:
{
  "blocks": [ ...Array of ${count} Block Objects... ]
}
`.trim();
    }

    /**
     * REPAIR
     */
    static generateRepairPrompt(block: Block): string {
        const dslSchema = blockRegistry.generatePromptSchema();
        
        return `
ROLE: You are a Code Repair Specialist and Instructional Designer.
TASK: The user has a block of content that is either malformed (syntax error) or unsatisfactory.
OBJECTIVE: Regenerate this specific block. Ensure strict adherence to the JSON schema.

BROKEN/SOURCE BLOCK:
${JSON.stringify(block, null, 2)}

${dslSchema}

INSTRUCTIONS:
1. Identify the intent of the block.
2. If it is a Diagram (Mermaid), fix the syntax.
3. If it is missing fields, populate them with high-quality content matching the original topic.
4. Return exactly ONE valid block object in the "blocks" array.

OUTPUT FORMAT:
{
  "blocks": [ ... 1 Corrected Block Object ... ]
}
`.trim();
    }

    /**
     * WEEKLY SYNTHESIS
     */
    static generateSynthesisPrompt(stats: { totalReviewed: number, topConcept: string, masteryAvg: number }, concepts: string[]): string {
        const dslSchema = blockRegistry.generatePromptSchema();
        return `
ROLE: You are a Socratic Mentor facilitating meta-cognitive reflection.
TASK: Create a "Weekly Synthesis" lesson.
CONTEXT: This week, the student reviewed ${stats.totalReviewed} blocks, achieved ${stats.masteryAvg}% mastery, and focused heavily on "${stats.topConcept}".
CONCEPTS COVERED: ${concepts.slice(0, 10).join(', ')}...

OBJECTIVE:
Create a lesson that forces the student to "connect the dots" between these concepts. Do NOT just ask definitions. Ask for relationships, causality, and systems thinking.

STRUCTURE:
1. Intro: Acknowledging progress.
2. The "Big Question": A complex text/thought experiment connecting at least 3 of the concepts.
3. Active Synthesis: 2-3 interactive blocks (Sort or Match type preferred) that require categorization or linking of these concepts.

${dslSchema}

${SystemContextLoader.GLOBAL_PAGE_SCHEMA}
`.trim();
    }

    /**
     * CHAPTER EVOLUTION (NEW: Page Cycle)
     */
    static generateChapterEvolutionPrompt(pageTitle: string, currentChapter: number, blockSummaries: string[], retrievalText: string): string {
        const dslSchema = blockRegistry.generatePromptSchema();
        const nextChapter = currentChapter + 1;

        return `
ROLE: You are the "Evolution Engine" for an adaptive learning system.
TASK: Generate "Chapter ${nextChapter}" for the lesson: "${pageTitle}".

CONTEXT (Existing Content):
The page currently contains concepts related to: ${blockSummaries.slice(0, 10).join(', ')}...

DIAGNOSTIC (Student's Active Recall):
The student was asked to retrieve what they know about this page. Here is what they remembered:
"${retrievalText}"

ANALYSIS & STRATEGY:
1. Compare the Student's Recall vs. Existing Content.
2. **Gap Analysis:** What important concepts did they miss or explain poorly? -> Create REINFORCEMENT blocks for these.
3. **Extension:** What did they understand well? -> Create ADVANCED APPLICATION blocks for these (Level Up).
4. **Cohesion:** Ensure the new chapter flows logically below the previous one.

CONTENT REQUIREMENTS:
- Create 3-5 new blocks.
- Use a mix of 'text' (to explain advanced nuance) and interactive blocks ('mcq', 'input', 'match', 'diagram').
- Start with a Section Header: "Chapter ${nextChapter}: [Thematic Title]".
- **ANTI-SPOILER:** Do not reveal answers in text before asking them.
- **DRY:** Do not duplicate concept names/IDs unless they are a higher level.

${dslSchema}

OUTPUT FORMAT:
{
  "blocks": [ ... Array of New Blocks ... ]
}
`.trim();
    }
}
