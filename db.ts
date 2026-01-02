
import Dexie, { Table } from 'dexie';
import { Page, BlockType, StudySession } from './types';

// Fix: Dexie mapped types fail with recursive types like Block (via variations).
// We define a simpler interface for the DB table where blocks are any[].
interface DexiePage extends Omit<Page, 'blocks'> {
    blocks: any[];
}

class EduForgeDatabase extends Dexie {
    pages!: Table<DexiePage>; // Use DexiePage instead of Page
    studySessions!: Table<StudySession>; // NEW: Real-time telemetry

    constructor() {
        super('EduForgeDB');
        // Dexie version method sometimes causes type issues in subclasses depending on TS setup
        (this as any).version(1).stores({
            pages: 'id, title, createdAt, *tags',
            studySessions: 'id, pageId, startTime, endTime'
        });
    }
}

export const db = new EduForgeDatabase();

export const seedDatabase = async () => {
    const count = await db.pages.count();
    if (count > 0) return; // Already seeded

    const now = Date.now();

    // 1. FUNDAMENTAL PAGE (The Base)
    const kinematicsPage: Page = {
        id: 'page-kinematics',
        title: 'Kinematics: The Basics of Motion',
        createdAt: now,
        updatedAt: now,
        tags: ['Physics/Mechanics', 'Foundation'],
        blocks: [
            { id: 'k1', type: BlockType.TEXT, variant: 'heading', content: 'Velocity & Acceleration' },
            {
                id: 'k2', type: BlockType.MCQ,
                question: 'Which vector quantity represents the rate of change of position?',
                options: [
                    { id: 'o1', text: 'Speed', isCorrect: false },
                    { id: 'o2', text: 'Velocity', isCorrect: true, feedback: 'Correct. It has direction.' }
                ],
                srs: {
                    entityId: 'concept.physics.velocity',
                    name: 'VELOCITY',
                    objective: 'Define velocity vs speed.',
                    repetitionCount: 1, stability: 5, difficulty: 2, masteryScore: 60, level: 1, nextReviewDue: now + 86400000
                }
            },
            {
                id: 'k3', type: BlockType.INPUT,
                prompt: 'What is the standard unit for Acceleration?',
                correctAnswer: ['m/s^2', 'meters per second squared'],
                srs: {
                    entityId: 'concept.physics.acceleration',
                    name: 'ACCELERATION',
                    objective: 'Recall SI units.',
                    repetitionCount: 2, stability: 12, difficulty: 3, masteryScore: 80, level: 1, nextReviewDue: now + 300000000
                }
            },
            {
                id: 'k4', 
                type: BlockType.CHART,
                chartType: 'area',
                title: 'Velocity vs. Time (Constant Acceleration)',
                xAxisKey: 'time',
                data: [
                    { time: 0, velocity: 0, name: 0 },
                    { time: 2, velocity: 4, name: 2 },
                    { time: 4, velocity: 8, name: 4 },
                    { time: 6, velocity: 12, name: 6 },
                    { time: 8, velocity: 16, name: 8 },
                    { time: 10, velocity: 20, name: 10 }
                ],
                series: [
                    { dataKey: 'velocity', color: '#8884d8', name: 'Velocity (m/s)' }
                ]
            }
        ]
    };

    // 2. CONNECTED PAGE (Uses Velocity & Acceleration + Adds Force)
    const dynamicsPage: Page = {
        id: 'page-dynamics',
        title: 'Dynamics: Forces in Action',
        createdAt: now + 1000,
        updatedAt: now + 1000,
        tags: ['Physics/Dynamics', 'Newton'],
        blocks: [
            { id: 'd1', type: BlockType.MATH, latex: 'F = ma', description: 'Newton\'s Second Law' },
            {
                id: 'd2', type: BlockType.MCQ,
                question: 'If you double the mass (m) while keeping force (F) constant, what happens to acceleration (a)?',
                options: [
                    { id: 'o1', text: 'It doubles', isCorrect: false },
                    { id: 'o2', text: 'It halves', isCorrect: true, feedback: 'Correct. a = F/m.' }
                ],
                // SHARED CONCEPT: ACCELERATION (Connects to Kinematics)
                srs: {
                    entityId: 'concept.physics.acceleration', 
                    name: 'ACCELERATION RELATIONS',
                    objective: 'Relate a to F and m.',
                    repetitionCount: 1, stability: 3, difficulty: 5, masteryScore: 40, level: 2, integratedLevels: [1], nextReviewDue: now + 10000
                }
            },
            {
                id: 'd3', type: BlockType.INPUT,
                prompt: 'What property of matter resists changes in motion?',
                correctAnswer: ['Inertia', 'Mass'],
                srs: {
                    entityId: 'concept.physics.mass',
                    name: 'MASS/INERTIA',
                    objective: 'Define Mass conceptualy.',
                    repetitionCount: 0, stability: 0, difficulty: 0, masteryScore: 0, level: 1
                }
            }
        ]
    };

    // 3. INTEGRATION PAGE (Uses Mass & Velocity -> Connects to BOTH previous)
    const energyPage: Page = {
        id: 'page-energy',
        title: 'Work & Energy Systems',
        createdAt: now + 2000,
        updatedAt: now + 2000,
        tags: ['Physics/Energy'],
        blocks: [
            { id: 'e1', type: BlockType.TEXT, variant: 'callout', content: 'Energy cannot be created or destroyed.' },
            {
                id: 'e2', type: BlockType.MATH, latex: 'KE = \\frac{1}{2}mv^2', description: 'Kinetic Energy'
            },
            {
                id: 'e3', type: BlockType.MCQ,
                question: 'To calculate Kinetic Energy, which two quantities do you need?',
                options: [
                    { id: 'o1', text: 'Force & Distance', isCorrect: false },
                    { id: 'o2', text: 'Mass & Velocity', isCorrect: true }
                ],
                // SHARED CONCEPTS: MASS (from Dynamics) and VELOCITY (from Kinematics)
                // This makes this page a "Hub" connecting everything.
                srs: {
                    entityId: 'concept.physics.energy.kinetic',
                    name: 'KINETIC ENERGY',
                    objective: 'Calculate KE.',
                    repetitionCount: 5, stability: 45, difficulty: 2, masteryScore: 95, level: 2, integratedLevels: [1], nextReviewDue: now + 900000000
                }
            }
        ]
    };

    // 4. HABITS PAGE (Life Forge Example)
    const habitsPage: Page = {
        id: 'page-habits',
        title: 'Daily Rituals & Objectives',
        createdAt: now + 4000,
        updatedAt: now + 4000,
        tags: ['Life/Wellness', 'Productivity'],
        blocks: [
            {
                id: 'h1', type: BlockType.TEXT, variant: 'quote', content: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.'
            },
            {
                id: 'h2', type: BlockType.HABIT,
                prompt: 'Morning Deep Work (2h)',
                frequency: 'daily',
                streak: 4,
                history: [
                    now - 86400000 * 1, // Yesterday
                    now - 86400000 * 2,
                    now - 86400000 * 3,
                    now - 86400000 * 4
                ]
            },
            {
                id: 'h3', type: BlockType.HABIT,
                prompt: 'Hydration (2L)',
                frequency: 'daily',
                streak: 12,
                history: [now - 86400000] // Dummy history
            },
            {
                id: 't1', type: BlockType.TASK,
                content: 'Review the **Kinematics** chapter for the exam.',
                isCompleted: false,
                dueDate: now + 86400000, // Due tomorrow
                priority: 'high'
            },
            {
                id: 't2', type: BlockType.TASK,
                content: 'Buy new notebook for calculus.',
                isCompleted: true,
                dueDate: now - 86400000,
                priority: 'low'
            }
        ]
    };

    // 5. COMPUTER SCIENCE (New Code/Diagram Support)
    const csPage: Page = {
        id: 'page-cs-algorithms',
        title: 'Algorithms: Binary Search',
        createdAt: now + 5000,
        updatedAt: now + 5000,
        tags: ['CS/Algorithms', 'Coding'],
        blocks: [
            { id: 'cs1', type: BlockType.TEXT, variant: 'heading', content: 'Understanding Binary Search' },
            { 
                id: 'cs2', 
                type: BlockType.TEXT, 
                variant: 'paragraph', 
                content: 'Binary search is an efficient algorithm for finding an item from a sorted list of items. It works by repeatedly dividing in half the portion of the list that could contain the item.' 
            },
            {
                id: 'cs3',
                type: BlockType.DIAGRAM,
                chart: `graph TD
    A[Start] --> B{Is Array Empty?};
    B -- Yes --> C[Return -1];
    B -- No --> D[Find Middle Element];
    D --> E{Is Target == Middle?};
    E -- Yes --> F[Return Middle Index];
    E -- No --> G{Is Target < Middle?};
    G -- Yes --> H[Search Left Half];
    G -- No --> I[Search Right Half];
    H --> B;
    I --> B;`,
                caption: 'Visual flow of the Recursive Binary Search process'
            },
            {
                id: 'cs4',
                type: BlockType.CODE,
                language: 'python',
                caption: 'Python Implementation (Recursive)',
                code: `def binary_search(arr, low, high, x):
    # Check base case
    if high >= low:
        mid = (high + low) // 2

        # If element is present at the middle itself
        if arr[mid] == x:
            return mid

        # If element is smaller than mid, then it can only
        # be present in left subarray
        elif arr[mid] > x:
            return binary_search(arr, low, mid - 1, x)

        # Else the element can only be present in right subarray
        else:
            return binary_search(arr, mid + 1, high, x)

    else:
        # Element is not present in the array
        return -1`
            },
            {
                id: 'cs5',
                type: BlockType.MCQ,
                question: 'What is the Time Complexity of Binary Search?',
                options: [
                    { id: 'o1', text: 'O(n)', isCorrect: false },
                    { id: 'o2', text: 'O(log n)', isCorrect: true, feedback: 'Correct. The search space is halved every step.' },
                    { id: 'o3', text: 'O(n^2)', isCorrect: false }
                ],
                srs: {
                    entityId: 'concept.cs.complexity.binary',
                    name: 'BINARY SEARCH',
                    objective: 'Identify O(log n) complexity.',
                    repetitionCount: 0, stability: 0, difficulty: 0, masteryScore: 0, level: 1
                }
            },
            {
                id: 'cs6',
                type: BlockType.CHART,
                chartType: 'bar',
                title: 'Search Steps vs Array Size',
                xAxisKey: 'size',
                data: [
                    { size: 10, linear: 10, binary: 4, name: 10 },
                    { size: 100, linear: 100, binary: 7, name: 100 },
                    { size: 1000, linear: 1000, binary: 10, name: 1000 },
                    { size: 10000, linear: 10000, binary: 14, name: 10000 }
                ],
                series: [
                    { dataKey: 'linear', color: '#f87171', name: 'Linear Search (Worst Case)' },
                    { dataKey: 'binary', color: '#4ade80', name: 'Binary Search (Worst Case)' }
                ]
            }
        ]
    };

    await db.pages.bulkAdd([kinematicsPage, dynamicsPage, energyPage, habitsPage, csPage]);
    console.log('Database seeded with Knowledge Graph, Habits, and Code Examples.');
};
