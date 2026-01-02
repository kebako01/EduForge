
import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { Page, Block, BlockType, CourseMapBlock } from '../types';
import { Search, FileText, Atom, Clock, ChevronLeft, BookOpen, ZoomIn, ZoomOut, Layers, HelpCircle, Map as MapIcon, Library, Sliders, X, MousePointer2, Radar, Target, Lock, Unlock, ScanLine, Info, Move, MousePointerClick, Zap, Sparkles, RefreshCw, AlertTriangle, Cpu, Activity, Database, AlertCircle } from 'lucide-react';

interface ReviewAtlasProps {
    pages: Page[];
    virtualNow: number;
    onNavigateToPage: (id: string) => void;
}

// --- COSMIC TYPES ---
interface GraphNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    displayLabel: string;
    type: 'course' | 'page' | 'concept';
    
    // Logic Props
    level: number;
    degree: number;
    isNew: boolean;
    isDue: boolean;
    
    // Visual Props
    baseRadius: number;
    labelLength: number;
    group: string;       
    color: string;
    
    // Organic Physics (Drift)
    driftPhase: number;
    driftSpeed: number;
    
    data?: any; 
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    source: string | GraphNode;
    target: string | GraphNode;
    value: number; 
}

interface Star {
    x: number;
    y: number;
    z: number; // Depth (0.1 to 1.0)
    size: number;
    brightness: number;
}

// --- GRAPH CONFIGURATION INTERFACE ---
interface GraphConfig {
    repulsion: number;      
    linkDistance: number;   
    clusterStrength: number;
}

const DEFAULT_CONFIG: GraphConfig = { 
    repulsion: 1.0, 
    linkDistance: 1.0, 
    clusterStrength: 0.06 
};

const DOMAIN_THEMES: Record<string, { color: string; xBias: number; yBias: number }> = {
    'Physics':  { color: '#60a5fa', xBias: -0.6, yBias: -0.5 }, // Blue-400
    'Math':     { color: '#a78bfa', xBias: 0.6, yBias: -0.5 },  // Violet-400
    'CS':       { color: '#f472b6', xBias: -0.5, yBias: 0.6 },  // Pink-400
    'Life':     { color: '#34d399', xBias: 0.5, yBias: 0.6 },   // Emerald-400
    'History':  { color: '#fbbf24', xBias: 0, yBias: -0.7 },    // Amber-400
    'Unsorted': { color: '#94a3b8', xBias: 0, yBias: 0 }        // Slate-400
};

const COLORS = {
    bg: '#0f172a',   // Deep Space (Slate-900)
    page: '#f8fafc', // Slate-50
    course: '#fcd34d', // Amber-300
    due: '#f43f5e',  // Rose-500
    text: '#e2e8f0', // Slate-200
    dimLink: '#1e293b', 
    highlightLink: '#64748b' 
};

const truncateLabel = (str: string, maxLength: number = 20) => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
};

// --- TUTORIAL OVERLAY COMPONENT ---
const TutorialOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-500" onClick={onClose}>
        <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-indigo-500/30 relative text-slate-100" onClick={e => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5"/></button>
            
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                    <Radar className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">Cosmic Interface</h3>
                <p className="text-slate-400 mt-2 text-sm">Navigate the constellation of your knowledge.</p>
            </div>

            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700"><Move className="w-6 h-6 text-indigo-400" /></div>
                    <div>
                        <h4 className="font-bold text-white">Drift & Pan</h4>
                        <p className="text-xs text-slate-400">Click and drag space to move the universe.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700"><ZoomIn className="w-6 h-6 text-indigo-400" /></div>
                    <div>
                        <h4 className="font-bold text-white">Deep Zoom</h4>
                        <p className="text-xs text-slate-400">Scroll to travel between clusters and details.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700"><MousePointerClick className="w-6 h-6 text-indigo-400" /></div>
                    <div>
                        <h4 className="font-bold text-white">Target Lock</h4>
                        <p className="text-xs text-slate-400">Hover to scan. Click to lock selection.</p>
                    </div>
                </div>
            </div>

            <button onClick={onClose} className="mt-8 w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/50">
                Initialize Systems
            </button>
        </div>
    </div>
);

export const ReviewAtlas: React.FC<ReviewAtlasProps> = ({ pages, virtualNow, onNavigateToPage }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // D3 Refs
    const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
    const quadtreeRef = useRef<d3.Quadtree<GraphNode> | null>(null); 
    
    // State
    const [lockedNode, setLockedNode] = useState<GraphNode | null>(null); 
    const [scannedNode, setScannedNode] = useState<GraphNode | null>(null); 
    const [showTutorial, setShowTutorial] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    // LAYOUT STATE (Crucial for Physics Init)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Error Handling State
    const [crashError, setCrashError] = useState<string | null>(null);
    const renderLoopId = useRef<number | null>(null);
    
    const [showSettings, setShowSettings] = useState(false);
    
    // PERSISTENCE CONFIGURATION
    const [graphConfig, setGraphConfig] = useState<GraphConfig>(() => {
        try {
            if (typeof window !== 'undefined') {
                const saved = localStorage.getItem('eduforge_atlas_config');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    return { ...DEFAULT_CONFIG, ...parsed };
                }
            }
        } catch (e) {
            console.error("Failed to load physics config", e);
        }
        return DEFAULT_CONFIG;
    });

    // Auto-Save Effect (Debounced)
    useEffect(() => {
        const handler = setTimeout(() => {
            localStorage.setItem('eduforge_atlas_config', JSON.stringify(graphConfig));
        }, 500);
        return () => clearTimeout(handler);
    }, [graphConfig]);

    const handleConfigChange = (key: keyof GraphConfig, value: number) => {
        setGraphConfig(prev => ({ ...prev, [key]: value }));
    };

    const resetConfiguration = () => {
        setGraphConfig(DEFAULT_CONFIG);
        localStorage.setItem('eduforge_atlas_config', JSON.stringify(DEFAULT_CONFIG));
    };

    // RADAR STABILIZER (Debounce)
    const hoverTimerRef = useRef<any>(null);
    const pendingNodeRef = useRef<string | null>(null);

    // Active Node Logic
    const activeNode = lockedNode || scannedNode;
    const isPreviewMode = !lockedNode && !!scannedNode;

    // Loop Refs to avoid stale closures
    const stateRef = useRef({
        lockedNode,
        scannedNode,
        searchQuery,
        width: 0,
        height: 0,
        transform: d3.zoomIdentity,
        stars: [] as Star[]
    });

    // Sync Refs
    useEffect(() => { 
        stateRef.current.lockedNode = lockedNode; 
        stateRef.current.scannedNode = scannedNode;
        stateRef.current.searchQuery = searchQuery;
    }, [lockedNode, scannedNode, searchQuery]);

    // --- 1. DATA CONSTRUCTION ---
    const graphData = useMemo(() => {
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const conceptMap = new Map<string, GraphNode>();
        const connectionCounts = new Map<string, number>();

        // 1a. Build Nodes
        pages.forEach(page => {
            let domain = 'Unsorted';
            const firstTag = page.tags?.[0];
            if (firstTag) {
                const rootTag = firstTag.split('/')[0];
                if (DOMAIN_THEMES[rootTag]) domain = rootTag;
                else if (rootTag.includes('Life') || rootTag.includes('Health')) domain = 'Life';
                else if (rootTag.includes('Comp') || rootTag.includes('Code')) domain = 'CS';
                else if (rootTag.includes('Math')) domain = 'Math';
                else if (rootTag.includes('Phys')) domain = 'Physics';
            }

            const courseBlock = page.blocks.find(b => b.type === BlockType.COURSE_MAP) as CourseMapBlock | undefined;
            const isCourse = !!courseBlock;
            const isNewStructure = page.blocks.length === 0;
            let baseRadius = isCourse ? 80 : 30;

            // Check if any block in page is due
            const pageIsDue = page.blocks.some(b => b.srs && b.srs.nextReviewDue && b.srs.nextReviewDue <= virtualNow);

            const node: GraphNode = {
                id: page.id,
                label: page.title,
                displayLabel: truncateLabel(page.title, isCourse ? 30 : 20),
                type: isCourse ? 'course' : 'page',
                group: domain,
                degree: 0, 
                level: isCourse ? 5 : 3, 
                isNew: isNewStructure, 
                isDue: pageIsDue, // Inherit due status
                baseRadius: baseRadius,
                labelLength: page.title.length,
                color: isCourse ? COLORS.course : COLORS.page,
                // Organic Props
                driftPhase: Math.random() * Math.PI * 2,
                driftSpeed: 0.0005 + Math.random() * 0.001,
                data: page
            };
            nodes.push(node);

            if (courseBlock) {
                courseBlock.nodes.forEach(childNode => {
                    if (childNode.targetPageId) {
                        const targetExists = pages.some(p => p.id === childNode.targetPageId);
                        if (targetExists) {
                            links.push({ source: page.id, target: childNode.targetPageId, value: 5 });
                        }
                    }
                });
            }
        });

        // 1b. Concepts
        pages.forEach(page => {
            page.blocks.forEach(b => {
                if (b.srs?.entityId) {
                    const srs = b.srs;
                    links.push({ source: page.id, target: srs.entityId, value: 1 });
                    
                    if (!conceptMap.has(srs.entityId)) {
                        const domain = nodes.find(n => n.id === page.id)?.group || 'Unsorted';
                        const cNode: GraphNode = {
                            id: srs.entityId,
                            label: srs.name || 'Concept',
                            displayLabel: truncateLabel(srs.name || 'Concept', 15),
                            type: 'concept',
                            group: domain,
                            degree: 0,
                            level: srs.level,
                            isNew: srs.repetitionCount === 0,
                            isDue: (srs.nextReviewDue || 0) <= virtualNow,
                            baseRadius: 10, 
                            labelLength: (srs.name || '').length,
                            color: DOMAIN_THEMES[domain].color,
                            driftPhase: Math.random() * Math.PI * 2,
                            driftSpeed: 0.001 + Math.random() * 0.002,
                            data: { srs }
                        };
                        conceptMap.set(srs.entityId, cNode);
                        nodes.push(cNode);
                    }
                }
            });
        });

        // Calculate degrees
        links.forEach(l => {
            const sid = typeof l.source === 'object' ? l.source.id : l.source;
            const tid = typeof l.target === 'object' ? l.target.id : l.target;
            connectionCounts.set(sid, (connectionCounts.get(sid) || 0) + 1);
            connectionCounts.set(tid, (connectionCounts.get(tid) || 0) + 1);
        });

        nodes.forEach(n => {
            n.degree = connectionCounts.get(n.id) || 0;
            if (n.type === 'course') n.baseRadius = Math.min(100, 70 + (n.degree * 1.5));
            else if (n.type === 'page') n.baseRadius = Math.min(50, 25 + (n.degree * 1.2));
            else n.baseRadius = Math.min(25, 8 + (n.level * 2) + (n.degree * 0.5));
        });

        return { nodes, links };
    }, [pages, virtualNow]);

    // --- RECOVERY PROTOCOL ---
    const reloadSystem = () => {
        setCrashError(null);
        if (renderLoopId.current) cancelAnimationFrame(renderLoopId.current);
        setTimeout(() => {
            // Re-init logic triggers via state change
        }, 100);
    };

    // --- 2. ENGINE SETUP (OPTIMIZED) ---
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current || graphData.nodes.length === 0) return;
        if (crashError) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false }); 
        if (!ctx) return;

        // Init Physics
        const simulation = d3.forceSimulation<GraphNode>(graphData.nodes)
            .force('link', d3.forceLink<GraphNode, GraphLink>(graphData.links).id(d => d.id))
            .force('charge', d3.forceManyBody())
            .force('collide', d3.forceCollide<GraphNode>())
            .force('clusterX', d3.forceX<GraphNode>())
            .force('clusterY', d3.forceY<GraphNode>());

        // OPTIMIZATION: Stop simulation when stable to save CPU
        simulation.on('end', () => {
            quadtreeRef.current = d3.quadtree<GraphNode>()
                .x(d => d.x || 0)
                .y(d => d.y || 0)
                .addAll(graphData.nodes);
        });

        let tickCount = 0;
        simulation.on('tick', () => {
            tickCount++;
            if (tickCount % 20 === 0) {
                quadtreeRef.current = d3.quadtree<GraphNode>()
                    .x(d => d.x || 0)
                    .y(d => d.y || 0)
                    .addAll(graphData.nodes);
            }
        });

        simulationRef.current = simulation;

        // Init Stars (Background)
        const starCount = 300;
        const stars: Star[] = [];
        for(let i=0; i<starCount; i++) {
            stars.push({
                x: (Math.random() - 0.5) * 4000,
                y: (Math.random() - 0.5) * 4000,
                z: 0.1 + Math.random() * 0.9, 
                size: Math.random() * 1.5,
                brightness: 0.3 + Math.random() * 0.7
            });
        }
        stateRef.current.stars = stars;

        // Init Zoom
        const zoom = d3.zoom<HTMLCanvasElement, unknown>()
            .scaleExtent([0.1, 4]) 
            .on('start', () => setIsDragging(true))
            .on('zoom', (event) => {
                stateRef.current.transform = event.transform;
            })
            .on('end', () => setIsDragging(false));
        
        zoomBehaviorRef.current = zoom;
        d3.select(canvas).call(zoom).on("dblclick.zoom", null);

        // Center initially
        const initialTransform = d3.zoomIdentity.translate(canvas.width / 2, canvas.height / 2).scale(0.6);
        d3.select(canvas).call(zoom.transform, initialTransform);

        // --- OPTIMIZED RENDER LOOP ---
        
        const renderReticle = (node: GraphNode, k: number, time: number) => {
            const r = node.baseRadius * 1.4;
            const rotation = time / 1500; 
            
            ctx.save();
            const driftX = Math.sin(time * node.driftSpeed + node.driftPhase) * 3;
            const driftY = Math.cos(time * node.driftSpeed + node.driftPhase) * 3;
            ctx.translate(node.x! + driftX, node.y! + driftY);
            
            ctx.rotate(rotation);
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0, r), 0, Math.PI * 2);
            ctx.strokeStyle = node.color;
            ctx.lineWidth = 1 / k;
            ctx.setLineDash([20/k, 40/k]); 
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            
            ctx.rotate(-rotation * 2);
            ctx.setLineDash([]);
            const length = Math.PI / 3;
            
            // CRITICAL FIX: Ensure radius is not negative when zoomed out
            const innerRadius = Math.max(0, r - (5/k));

            ctx.beginPath();
            for(let i=0; i<3; i++) {
                ctx.rotate((Math.PI * 2) / 3);
                ctx.moveTo(innerRadius, 0);
                ctx.arc(0, 0, innerRadius, -length/2, length/2);
            }
            ctx.lineWidth = 2 / k;
            ctx.shadowBlur = 10;
            ctx.shadowColor = node.color;
            ctx.globalAlpha = 0.8;
            ctx.stroke();

            ctx.restore();
        };

        const render = (time: number) => {
            try {
                const { width, height, transform, lockedNode, scannedNode, searchQuery, stars } = stateRef.current;
                const k = transform.k;

                const tl = transform.invert([0, 0]);
                const br = transform.invert([width, height]);
                const viewL = tl[0] - 100; // Margin
                const viewT = tl[1] - 100;
                const viewR = br[0] + 100;
                const viewB = br[1] + 100;

                ctx.fillStyle = '#02040a';
                ctx.fillRect(0, 0, width, height);

                ctx.save();
                ctx.translate(width/2, height/2); 
                stars.forEach(star => {
                    const x = (star.x * k + transform.x - width/2) * star.z;
                    const y = (star.y * k + transform.y - height/2) * star.z;
                    
                    if (x > -width/2 && x < width/2 && y > -height/2 && y < height/2) {
                        const size = star.size * star.z * (k > 1 ? k * 0.5 : 1);
                        ctx.beginPath();
                        ctx.arc(x, y, Math.max(0, size), 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * star.z})`;
                        ctx.fill();
                    }
                });
                ctx.restore();

                ctx.save();
                ctx.translate(transform.x, transform.y);
                ctx.scale(k, k);

                const activeId = lockedNode?.id || scannedNode?.id;
                
                ctx.beginPath(); 
                
                graphData.links.forEach((link) => {
                    const s = link.source as GraphNode;
                    const tr = link.target as GraphNode;
                    
                    const sOut = s.x! < viewL || s.x! > viewR || s.y! < viewT || s.y! > viewB;
                    const tOut = tr.x! < viewL || tr.x! > viewR || tr.y! < viewT || tr.y! > viewB;
                    
                    if (sOut && tOut) return; 

                    const sDriftX = Math.sin(time * s.driftSpeed + s.driftPhase) * 3;
                    const sDriftY = Math.cos(time * s.driftSpeed + s.driftPhase) * 3;
                    const tDriftX = Math.sin(time * tr.driftSpeed + tr.driftPhase) * 3;
                    const tDriftY = Math.cos(time * tr.driftSpeed + tr.driftPhase) * 3;

                    const sx = s.x! + sDriftX;
                    const sy = s.y! + sDriftY;
                    const tx = tr.x! + tDriftX;
                    const ty = tr.y! + tDriftY;

                    const isActivePath = s.id === activeId || tr.id === activeId;
                    
                    if (isActivePath) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(tx, ty);
                        ctx.strokeStyle = s.group === tr.group ? s.color : '#ffffff';
                        ctx.globalAlpha = 0.6 + (Math.sin(time/200) * 0.2);
                        ctx.lineWidth = (s.type === 'course' ? 2.5 : 1.5) / k;
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = s.color;
                        ctx.stroke();
                        ctx.restore();
                    } else if (activeId) {
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(tx, ty);
                    } else {
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(tx, ty);
                    }
                });

                if (!activeId) {
                    ctx.strokeStyle = '#334155';
                    ctx.globalAlpha = 0.15;
                    ctx.lineWidth = 1 / k;
                    ctx.shadowBlur = 0;
                    ctx.stroke();
                } else {
                    ctx.strokeStyle = '#1e293b';
                    ctx.globalAlpha = 0.05;
                    ctx.lineWidth = 0.5 / k;
                    ctx.shadowBlur = 0;
                    ctx.stroke();
                }

                graphData.nodes.forEach(node => {
                    if (node.x! < viewL || node.x! > viewR || node.y! < viewT || node.y! > viewB) return;

                    const driftX = Math.sin(time * node.driftSpeed + node.driftPhase) * 3;
                    const driftY = Math.cos(time * node.driftSpeed + node.driftPhase) * 3;
                    const nx = node.x! + driftX;
                    const ny = node.y! + driftY;

                    const isTarget = activeId === node.id;
                    const isNeighbor = activeId && graphData.links.some(l => 
                        (l.source as GraphNode).id === activeId && (l.target as GraphNode).id === node.id ||
                        (l.target as GraphNode).id === activeId && (l.source as GraphNode).id === node.id
                    );
                    
                    const isDimmed = activeId && !isTarget && !isNeighbor;
                    if (isDimmed) ctx.globalAlpha = 0.1;
                    else ctx.globalAlpha = 1;

                    if (isTarget) renderReticle(node, k, time);

                    ctx.beginPath();
                    const r = node.baseRadius;
                    ctx.arc(nx, ny, Math.max(0, r), 0, 2 * Math.PI);
                    
                    ctx.fillStyle = node.isDue ? COLORS.due : node.color;
                    
                    if (!isDimmed) {
                        ctx.shadowBlur = isTarget ? 30 : 15;
                        ctx.shadowColor = node.color;
                    } else {
                        ctx.shadowBlur = 0;
                    }
                    ctx.fill();

                    if (node.type !== 'concept') {
                        ctx.fillStyle = 'rgba(255,255,255,0.15)';
                        ctx.beginPath();
                        ctx.arc(nx, ny, Math.max(0, r * 0.7), 0, 2 * Math.PI);
                        ctx.fill();
                    }

                    if (node.type === 'course' && !isDimmed) {
                        ctx.beginPath();
                        ctx.arc(nx, ny, Math.max(0, r + (5/k)), 0, 2 * Math.PI);
                        ctx.strokeStyle = node.color;
                        ctx.lineWidth = 1/k;
                        ctx.globalAlpha = 0.3;
                        ctx.stroke();
                    }
                });

                if (k > 0.4 || activeId) {
                    graphData.nodes.forEach(node => {
                        if (node.x! < viewL || node.x! > viewR || node.y! < viewT || node.y! > viewB) return;

                        const isTarget = activeId === node.id;
                        const isNeighbor = activeId && graphData.links.some(l => 
                            (l.source as GraphNode).id === activeId && (l.target as GraphNode).id === node.id ||
                            (l.target as GraphNode).id === activeId && (l.source as GraphNode).id === node.id
                        );
                        
                        let shouldShow = false;
                        if (isTarget || isNeighbor) shouldShow = true;
                        else if (!activeId) {
                            if (k < 0.6) shouldShow = node.type === 'course';
                            else if (k < 1.0) shouldShow = node.type !== 'concept';
                            else shouldShow = true;
                        }

                        if (!shouldShow) return;

                        const driftX = Math.sin(time * node.driftSpeed + node.driftPhase) * 3;
                        const driftY = Math.cos(time * node.driftSpeed + node.driftPhase) * 3;
                        const nx = node.x! + driftX;
                        const ny = node.y! + driftY;

                        const fontSize = Math.max(10, (node.baseRadius / 2) + 4) / Math.pow(k, 0.1); 
                        ctx.font = `${node.type === 'course' ? '700' : '500'} ${fontSize}px Inter, sans-serif`;
                        
                        const yOffset = node.baseRadius + (fontSize * 0.8) + 8;
                        const textWidth = ctx.measureText(node.displayLabel).width;
                        const padding = 6 / k;
                        
                        ctx.globalAlpha = activeId && !isTarget && !isNeighbor ? 0.2 : 0.9;

                        ctx.fillStyle = 'rgba(2, 6, 23, 0.7)'; 
                        ctx.beginPath();
                        ctx.roundRect(
                            nx - textWidth/2 - padding, 
                            ny + yOffset - fontSize/2 - padding, 
                            textWidth + padding*2, 
                            fontSize + padding*2, 
                            6/k
                        );
                        ctx.fill();
                        
                        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                        ctx.lineWidth = 1/k;
                        ctx.stroke();

                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#e2e8f0';
                        ctx.fillText(node.displayLabel, nx, ny + yOffset);
                    });
                }

                ctx.restore();
                renderLoopId.current = requestAnimationFrame(render);

            } catch (err) {
                console.error("Critical Render Failure:", err);
                setCrashError((err as Error).message);
            }
        };

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    canvas.width = width;
                    canvas.height = height;
                    stateRef.current.width = width;
                    stateRef.current.height = height;
                    // Trigger state update to force physics reconfiguration
                    setDimensions({ width, height });
                }
            }
        });
        resizeObserver.observe(containerRef.current);

        renderLoopId.current = requestAnimationFrame(render);

        return () => {
            resizeObserver.disconnect();
            if (renderLoopId.current) cancelAnimationFrame(renderLoopId.current);
            simulation.stop();
        };
    }, [graphData, crashError]);

    // --- 3. DYNAMIC PHYSICS UPDATES (Connected to Live Config & DIMENSIONS) ---
    useEffect(() => {
        if (!simulationRef.current || dimensions.width === 0) return;
        const sim = simulationRef.current;
        const { width, height } = dimensions;

        // Force Center (Depends on Dimensions)
        sim.force('center', d3.forceCenter(width / 2, height / 2));

        // Force Link Update
        sim.force('link', d3.forceLink<GraphNode, GraphLink>(graphData.links).id(d => d.id).distance(d => {
            const s = d.source as GraphNode;
            const t = d.target as GraphNode;
            let baseDist = 60;
            if (s.type === 'course' || t.type === 'course') baseDist = 140;
            else {
                baseDist = 70 + ((s.displayLabel.length + t.displayLabel.length) * 3);
            }
            return baseDist * graphConfig.linkDistance;
        }));

        // Force Charge Update
        sim.force('charge', d3.forceManyBody().strength(d => {
            const node = d as GraphNode;
            let baseCharge = -100;
            if (node.type === 'course') baseCharge = -800;
            else if (node.type === 'page') baseCharge = -300;
            return baseCharge * graphConfig.repulsion;
        }));

        sim.force('clusterX', d3.forceX<GraphNode>(d => {
            const bias = DOMAIN_THEMES[d.group]?.xBias || 0;
            return (width / 2) + (bias * 400); 
        }).strength(graphConfig.clusterStrength));

        sim.force('clusterY', d3.forceY<GraphNode>(d => {
            const bias = DOMAIN_THEMES[d.group]?.yBias || 0;
            return (height / 2) + (bias * 400);
        }).strength(graphConfig.clusterStrength));

        // Restart to apply visually
        sim.alpha(0.3).restart();
    }, [graphConfig, graphData, dimensions]); // Added dimensions dependency

    // --- 4. CINEMATIC FLY-TO (Zoom Logic) ---
    useEffect(() => {
        if (!lockedNode || !canvasRef.current || !zoomBehaviorRef.current) return;
        
        const node = graphData.nodes.find(n => n.id === lockedNode.id);
        if (node && node.x && node.y) {
            const canvas = canvasRef.current;
            const width = canvas.width;
            const height = canvas.height;
            const selectionOffset = 320; 
            
            const targetX = width < 768 ? width / 2 : (width / 2) + (selectionOffset / 4);
            
            const transform = d3.zoomIdentity
                .translate(targetX, height / 2)
                .scale(2.2) 
                .translate(-node.x, -node.y);

            d3.select(canvas)
                .transition()
                .duration(1500) 
                .ease(d3.easeCubicOut) 
                .call(zoomBehaviorRef.current.transform, transform);
        }
    }, [lockedNode]);

    // --- INTERACTION HANDLERS ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const getSubject = (event: MouseEvent) => {
            const t = d3.zoomTransform(canvas);
            const x = t.invertX(event.offsetX);
            const y = t.invertY(event.offsetY);
            
            if (!quadtreeRef.current) return null;

            const radius = 20 / t.k; 
            const closest = quadtreeRef.current.find(x, y, radius);
            
            return closest || null;
        }

        const handleMouseMove = (event: MouseEvent) => {
            const subject = getSubject(event);
            const canvas = canvasRef.current!;
            
            canvas.style.cursor = subject ? 'pointer' : (stateRef.current.lockedNode ? 'default' : 'grab');

            if (subject?.id !== pendingNodeRef.current) {
                pendingNodeRef.current = subject?.id || null;
                
                if (hoverTimerRef.current) {
                    clearTimeout(hoverTimerRef.current);
                    hoverTimerRef.current = null;
                }

                if (subject) {
                    hoverTimerRef.current = setTimeout(() => {
                        setScannedNode(subject);
                    }, 120); 
                } else {
                    setScannedNode(null);
                }
            }
        };

        const handleClick = (event: MouseEvent) => {
            const subject = getSubject(event);
            if (subject) {
                setLockedNode(subject); 
                setSearchQuery(''); 
            } else {
                if (!stateRef.current.lockedNode) return;
                setLockedNode(null); 
            }
        };

        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('click', handleClick);

        return () => {
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('click', handleClick);
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        };
    }, [graphData]);

    const filteredNodes = useMemo(() => {
        return graphData.nodes.filter(n => 
            // Removed filter: (n.type !== 'concept') to allow concepts in sidebar
            (!searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()))
        ).sort((a,b) => {
            if (a.isDue && !b.isDue) return -1;
            if (!a.isDue && b.isDue) return 1;
            if (a.type === 'course' && b.type !== 'course') return -1;
            if (a.type !== 'course' && b.type === 'course') return 1;
            if (a.type === 'page' && b.type === 'concept') return -1; // Pages before Concepts
            if (a.type === 'concept' && b.type === 'page') return 1;
            return a.label.localeCompare(b.label);
        });
    }, [graphData.nodes, searchQuery]);

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-500 relative">
            
            {/* Tutorial Overlay */}
            {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}

            {/* PHOENIX PROTOCOL (Recovery UI) */}
            {crashError && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
                    <div className="bg-slate-900 border border-red-500/50 rounded-2xl p-8 max-w-md text-center shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
                        <h2 className="text-2xl font-bold text-white mb-2">Neural Link Unstable</h2>
                        <p className="text-slate-400 mb-6 font-mono text-xs break-all border border-slate-800 p-2 rounded bg-black/50">
                            Error: {crashError}
                        </p>
                        <button 
                            onClick={reloadSystem}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 mx-auto transition-all hover:scale-105 shadow-lg"
                        >
                            <RefreshCw className="w-5 h-5 animate-spin-slow" />
                            <span>Reboot System</span>
                        </button>
                    </div>
                </div>
            )}

            {/* SIDEBAR - COMMAND CONSOLE (REDESIGNED) */}
            <div className={`
                absolute md:relative z-30 w-full md:w-80 flex flex-col gap-4 flex-shrink-0 h-full pointer-events-none md:pointer-events-auto
                transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
                ${activeNode ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="pointer-events-auto h-full flex flex-col">
                    {activeNode ? (
                        // LOCKED / SCANNED MODE (TACTICAL DOSSIER)
                        <div className={`
                            flex flex-col h-full rounded-2xl border overflow-hidden transition-all duration-500 shadow-2xl relative
                            ${lockedNode 
                                ? 'bg-slate-900/95 border-indigo-500/30 backdrop-blur-xl ring-1 ring-indigo-500/20' 
                                : 'bg-slate-900/80 backdrop-blur-md border-slate-700/50 text-white shadow-[0_0_30px_rgba(0,0,0,0.5)]'}
                        `}>
                            {/* Header Area */}
                            <div className="px-5 py-6 border-b border-indigo-500/20 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 relative">
                                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                                
                                <div className="flex justify-between items-start mb-4">
                                    <button onClick={() => { setLockedNode(null); setScannedNode(null); }} className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${lockedNode ? 'text-indigo-400 hover:text-white' : 'text-slate-400 hover:text-white'}`}>
                                        <ChevronLeft className="w-3 h-3" />
                                        <span>Back to Void</span>
                                    </button>
                                    
                                    {!lockedNode && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-bold uppercase animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                                            <ScanLine className="w-3 h-3" />
                                            <span>Scanning</span>
                                        </div>
                                    )}
                                    {lockedNode && (
                                        <div className="flex items-center gap-1.5 text-emerald-400 text-[9px] font-bold uppercase">
                                            <Target className="w-3 h-3" />
                                            <span>Target Locked</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className={`p-2.5 rounded-lg border shadow-lg ${
                                        lockedNode 
                                            ? 'bg-indigo-950/50 border-indigo-500/50 text-indigo-400 shadow-indigo-900/20' 
                                            : 'bg-slate-800 border-slate-600 text-slate-400'
                                    }`}>
                                        {activeNode.type === 'course' ? <Library className="w-6 h-6" /> : 
                                         activeNode.type === 'page' ? <FileText className="w-6 h-6" /> : <Atom className="w-6 h-6" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] font-bold text-indigo-500/80 uppercase tracking-widest mb-1">
                                            {activeNode.type === 'course' ? 'Constellation Hub' : activeNode.type === 'page' ? 'Knowledge Node' : 'Atomic Particle'}
                                        </div>
                                        <h2 className="text-lg font-bold text-white leading-tight line-clamp-2 drop-shadow-sm">{activeNode.label}</h2>
                                        
                                        {isPreviewMode && (
                                            <div className="mt-2 text-[10px] text-indigo-300/70 font-mono flex items-center gap-1">
                                                <MousePointer2 className="w-3 h-3" />
                                                CLICK_TO_LOCK
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 p-5 space-y-6 overflow-y-auto custom-scrollbar bg-slate-900/50">
                                {activeNode.type !== 'concept' ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-950/10 text-center relative overflow-hidden group">
                                                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <div className="text-2xl font-bold text-white mb-1 font-mono">{activeNode.degree}</div>
                                                <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Connections</div>
                                            </div>
                                            <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-950/10 text-center relative overflow-hidden group">
                                                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <div className="text-2xl font-bold text-white mb-1 font-mono">{activeNode.group.substring(0, 3).toUpperCase()}</div>
                                                <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Sector</div>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => onNavigateToPage(activeNode.id)} 
                                            className={`
                                                w-full py-3.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg group relative overflow-hidden
                                                ${lockedNode 
                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/40 border border-indigo-400/50' 
                                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'}
                                            `}
                                        >
                                            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent,rgba(255,255,255,0.1),transparent)] translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
                                            <BookOpen className="w-4 h-4" />
                                            <span className="uppercase tracking-wide text-xs">{lockedNode ? 'Initialize Sequence' : 'Access Data'}</span>
                                        </button>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg border border-indigo-500/20 bg-indigo-950/20 text-center relative">
                                            <div className="text-[10px] text-indigo-400 uppercase tracking-widest mb-2 font-bold">Neural Stability</div>
                                            <div className="text-3xl font-mono font-bold text-white tracking-tighter">{activeNode.data?.srs?.stability.toFixed(1)}<span className="text-sm text-indigo-500 ml-1">d</span></div>
                                            
                                            {/* Progress Bar Visual */}
                                            <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                                                <div className="h-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" style={{ width: `${Math.min(100, (activeNode.data?.srs?.stability || 0) * 5)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // DEFAULT LIST MODE (DATA LOG)
                        <div className="hidden md:flex flex-col h-full bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden relative">
                            
                            {/* Grid Background Effect */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

                            {showSettings ? (
                                <div className="flex flex-col h-full relative z-10 animate-in fade-in slide-in-from-top-2">
                                    <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
                                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                            <Cpu className="w-3 h-3" /> Physics Engine
                                        </div>
                                        <button onClick={() => setShowSettings(false)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                                    </div>
                                    <div className="p-5 space-y-8 flex-1 overflow-y-auto">
                                        <div className="space-y-4">
                                            <div className="space-y-3">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider"><span>Repulsion Field</span><span className="text-indigo-400">{graphConfig.repulsion.toFixed(1)}x</span></div>
                                                <input type="range" min="0.1" max="3.0" step="0.1" value={graphConfig.repulsion} onChange={(e) => handleConfigChange('repulsion', parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"/>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider"><span>Link Tensor</span><span className="text-indigo-400">{graphConfig.linkDistance.toFixed(1)}x</span></div>
                                                <input type="range" min="0.5" max="3.0" step="0.1" value={graphConfig.linkDistance} onChange={(e) => handleConfigChange('linkDistance', parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"/>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-700/50 space-y-3">
                                            <div className="text-center text-[10px] text-indigo-400 font-medium mb-2">
                                                Adjustments save automatically
                                            </div>
                                            <button onClick={resetConfiguration} className="w-full py-2 text-xs font-bold text-slate-500 hover:text-rose-400 bg-transparent hover:bg-slate-800/50 rounded border border-transparent hover:border-slate-700 transition-colors uppercase tracking-wider">
                                                Reset Systems
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="p-4 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/30 relative z-10">
                                        <div className="relative flex-1 group">
                                            <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                            <input 
                                                type="text" 
                                                placeholder="Search Database..." 
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg shadow-inner focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none text-xs text-slate-200 placeholder:text-slate-600 transition-all font-mono"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => setShowSettings(!showSettings)}
                                            className={`p-2.5 rounded-lg border transition-all relative ${showSettings ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600'}`}
                                            title="Graph Settings"
                                        >
                                            <Sliders className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar relative z-10">
                                        {filteredNodes.length === 0 ? (
                                            <div className="p-8 text-center opacity-30 flex flex-col items-center">
                                                <Database className="w-8 h-8 mb-2" />
                                                <span className="text-xs font-mono">NO_DATA_FOUND</span>
                                            </div>
                                        ) : (
                                            filteredNodes.map(node => ( 
                                                <button 
                                                    key={node.id} 
                                                    onClick={() => setLockedNode(node)} 
                                                    className={`
                                                        w-full text-left px-4 py-4 rounded-xl text-[15px] font-semibold transition-all flex items-center justify-between group border relative overflow-hidden
                                                        ${node.isDue 
                                                            ? 'bg-rose-950/30 border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.15)] ring-1 ring-rose-500/50' 
                                                            : 'bg-slate-800/20 border-transparent hover:bg-slate-800/60 hover:border-indigo-500/30'}
                                                    `}
                                                >
                                                    {/* Alert Animation for Due Items */}
                                                    {node.isDue && <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none"></div>}

                                                    <span className="truncate flex items-center gap-3.5 relative z-10">
                                                        <div className={`
                                                            w-2.5 h-2.5 rounded-full shadow-[0_0_8px] flex-shrink-0
                                                            ${node.isDue ? 'animate-ping' : ''}
                                                        `}
                                                        style={{ 
                                                            backgroundColor: node.isDue ? '#f43f5e' : node.color, 
                                                            boxShadow: `0 0 8px ${node.isDue ? '#f43f5e' : node.color}` 
                                                        }}
                                                        ></div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className={`font-mono leading-tight truncate ${node.isDue ? 'text-rose-100 font-bold tracking-wide drop-shadow-sm' : 'text-slate-300 group-hover:text-white'} ${node.type === 'course' ? 'font-bold tracking-wide' : ''}`}>
                                                                {node.label}
                                                            </span>
                                                            {node.isDue && (
                                                                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-1.5 bg-rose-950/50 px-2 py-0.5 rounded w-fit border border-rose-500/20">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    Critical Review
                                                                </span>
                                                            )}
                                                        </div>
                                                    </span>
                                                    {node.type === 'course' && <Layers className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 flex-shrink-0" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                    
                                    {/* Footer Status */}
                                    <div className="p-2 border-t border-slate-800 bg-slate-900/50 text-[9px] text-slate-500 font-mono text-center uppercase tracking-widest">
                                        System Online • {filteredNodes.length} Nodes Active
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* CANVAS CONTAINER */}
            <div ref={containerRef} className="flex-1 bg-[#02040a] rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden group">
                
                {/* HUD Controls */}
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                    <button 
                        onClick={() => setShowTutorial(true)}
                        className="bg-indigo-600/90 hover:bg-indigo-500 text-white p-3 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all hover:scale-110 backdrop-blur-sm"
                        title="Neural Guide"
                    >
                        <Info className="w-5 h-5" />
                    </button>
                    
                    <div className="bg-slate-900/80 backdrop-blur rounded-lg border border-slate-700 p-1 flex flex-col gap-1 shadow-lg mt-2">
                        <button 
                            onClick={() => {
                                if (canvasRef.current && zoomBehaviorRef.current) {
                                    d3.select(canvasRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
                                }
                            }}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => {
                                if (canvasRef.current && zoomBehaviorRef.current) {
                                    d3.select(canvasRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.7);
                                }
                            }}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Radar Status UI */}
                {!lockedNode && (
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
                        <div className={`w-2 h-2 rounded-full ${scannedNode ? 'bg-indigo-500 shadow-[0_0_10px_#6366f1]' : 'bg-slate-700'}`}></div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                            {scannedNode ? 'Target Acquired' : 'System Active'}
                        </span>
                    </div>
                )}

                {/* Legend */}
                <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 backdrop-blur rounded-lg border border-slate-700 p-3 text-[10px] text-slate-300 pointer-events-none shadow-xl">
                    <div className="flex items-center gap-2 mb-2 font-bold uppercase tracking-wider text-slate-500">
                        <Layers className="w-3 h-3" />
                        <span>Map Key</span>
                    </div>
                    <div className="space-y-1.5 mb-3 border-b border-slate-700 pb-2">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-amber-400 shadow-[0_0_5px_#fbbf24]"></div><span>Course Hub</span></div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-50"></div><span>Lesson Page</span></div>
                        <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_5px_#6366f1]"></div><span>Atomic Concept</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        {Object.entries(DOMAIN_THEMES).map(([key, theme]) => (
                            <div key={key} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.color, boxShadow: `0 0 5px ${theme.color}` }}></div>
                                <span className="opacity-90">{key}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <canvas 
                    ref={canvasRef} 
                    className={`w-full h-full block ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                />
                
                {graphData.nodes.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 pointer-events-none">
                        <MapIcon className="w-16 h-16 mb-4 opacity-20 text-indigo-500" />
                        <p className="text-sm font-medium text-slate-400">Neural Network Offline</p>
                    </div>
                )}
            </div>
        </div>
    );
};
