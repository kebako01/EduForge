
# EduForge - Architecture Guide

## How to Expand Interactive Blocks

EduForge uses a **Registry Pattern** combined with a **Self-Describing DSL** to ensure that adding new block types automatically updates both the UI and the AI's generation capabilities.

### 1. The Core Philosophy
- **SmartBlockShell:** All interactive blocks MUST be wrapped in `<SmartBlockShell>`. This handles:
  - Validation logic (Correct/Incorrect state).
  - Feedback UI (Hints, Explanation Modal).
  - Persistence (FSRS & SRS Data).
  - Variations (Lateral & Vertical evolution navigation).
- **Registry as Source of Truth:** `blockDefinitions.tsx` is the single source of truth. It defines:
  - The TypeScript Interface.
  - The UI Renderer.
  - The JSON Schema for the AI.

### 2. Step-by-Step: Adding a New Block

Example: Adding a `SliderBlock` (User selects a number on a range).

#### Step A: Define the Data Structure (`types.ts`)
Add the type to the Enum and create an interface.
```typescript
export enum BlockType {
    // ...
    SLIDER = 'slider' 
}

export interface SliderBlock extends BlockBase {
    type: BlockType.SLIDER;
    prompt: string;
    min: number;
    max: number;
    correctValue: number;
}
```

#### Step B: Create the Renderer (`components/BlockComponents.tsx`)
Create a component that consumes `data: SliderBlock`.
```tsx
export const SliderBlockRenderer = ({ data, pageId }) => {
    // 1. Hook into the Session Brain (handles variations)
    const { currentItem, ... } = useAdaptiveSession(data);
    const [val, setVal] = useState(0);

    return (
        <SmartBlockShell
            // Pass standard props...
            onVerify={async () => {
                // Return result
                return { isCorrect: val === currentItem.correctValue };
            }}
            onPersistState={...} // Save UI state to DB
        >
            {({ status, disabled }) => (
                // Render your custom UI here
                <input type="range" disabled={disabled} ... />
            )}
        </SmartBlockShell>
    )
}
```

#### Step C: Register the Block (`blockDefinitions.tsx`)
This is where the magic happens. By registering it here, the AI immediately knows how to use it.
```typescript
blockRegistry.register<SliderBlock>({
    type: BlockType.SLIDER,
    // 1. Teach the AI the JSON format
    promptSchema: `SliderBlock: { "type": "slider", "prompt": "str", "min": num, "max": num, "correctValue": num, "srs": {...} }`,
    // 2. Protect the App from bad AI JSON
    sanitize: (raw) => {
        if (typeof raw.min !== 'number') throw new Error("Missing min");
        return { ...raw, type: BlockType.SLIDER }; // return clean object
    },
    Component: SliderBlockRenderer
});
```

### 3. State Management & SRS
- **SRS Data:** Located in `block.srs`. This is the "Learning Memory".
- **UI State:** Located in `block.state`. This is "What did I just click?".
- **Persistence:** The `SmartBlockShell` exposes `onCommitSRS` (for long-term memory) and `onPersistState` (for UI restoration). Always connect these to the database helpers provided in `BlockComponents`.

### 4. AI Prompts
You do **NOT** need to edit `services/aiPrompts.ts` when adding blocks. The class `SystemContextLoader` calls `blockRegistry.generatePromptSchema()` to dynamically build the instructions for the LLM based on the active registry.
