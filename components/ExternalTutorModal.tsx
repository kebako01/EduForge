
import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ArrowRight, Bot, ExternalLink, Download, MessageSquare, AlertCircle } from 'lucide-react';
import { SystemContextLoader } from '../services/aiPrompts';
import { db } from '../db';
import { Page, Block, BlockType } from '../types';

interface ExternalTutorModalProps {
    isOpen: boolean;
    onClose: () => void;
    page: Page;
    onBlockAdded: () => void;
}

export const ExternalTutorModal: React.FC<ExternalTutorModalProps> = ({ isOpen, onClose, page, onBlockAdded }) => {
    const [step, setStep] = useState<'prompt' | 'ingest'>('prompt');
    const [prompt, setPrompt] = useState('');
    const [jsonInput, setJsonInput] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Generate prompt on open
    useEffect(() => {
        if (isOpen && page) {
            const p = SystemContextLoader.generateExternalTutorPrompt(page.title, page.blocks);
            setPrompt(p);
            setStep('prompt');
            setJsonInput('');
            setError(null);
        }
    }, [isOpen, page]);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(prompt);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleIngest = async () => {
        try {
            setError(null);
            // Defensive JSON Parsing
            const jsonMatch = jsonInput.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error("No JSON object found. Did you ask the AI to 'Save Session'?");
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Normalize input (could be { blocks: [] } or just [])
            const newBlocksRaw = Array.isArray(parsed) ? parsed : (parsed.blocks || [parsed]);
            
            if (!Array.isArray(newBlocksRaw) || newBlocksRaw.length === 0) {
                throw new Error("JSON is valid but contains no blocks.");
            }

            // Sanitize and ID generation
            const cleanBlocks: Block[] = newBlocksRaw.map((b: any) => ({
                ...b,
                id: b.id || `ext-${crypto.randomUUID()}`,
                type: Object.values(BlockType).includes(b.type) ? b.type : BlockType.TEXT,
                // Ensure SRS consistency if present
                srs: b.srs ? {
                    ...b.srs,
                    entityId: b.srs.entityId || `concept.${crypto.randomUUID()}`,
                    repetitionCount: 0,
                    stability: 0,
                    masteryScore: 0
                } : undefined
            }));

            // Append to Page
            await (db as any).transaction('rw', db.pages, async () => {
                const currentPage = await db.pages.get(page.id);
                if (currentPage) {
                    const updatedBlocks = [...currentPage.blocks, ...cleanBlocks];
                    await db.pages.update(page.id, { 
                        blocks: updatedBlocks,
                        updatedAt: Date.now() 
                    } as any);
                }
            });

            onBlockAdded();
            onClose();

        } catch (e) {
            setError((e as Error).message);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center space-x-2 text-gray-800">
                        <div className="p-1.5 bg-black text-white rounded-lg">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg leading-tight">External Tutor Protocol</h2>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Fluid Master v3.0</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-0 overflow-y-auto flex-1 bg-gray-50/50">
                    
                    {step === 'prompt' ? (
                        <div className="p-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="mb-6 flex items-start gap-4 bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                                <MessageSquare className="w-6 h-6 text-indigo-600 mt-1 flex-shrink-0" />
                                <div>
                                    <h3 className="font-bold text-indigo-900 text-sm">How to use Fluid Master</h3>
                                    <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                                        1. Copy the prompt below.<br/>
                                        2. Paste it into <strong>ChatGPT, Claude, or Gemini</strong>.<br/>
                                        3. Have a conversation. The AI will adapt to your style.<br/>
                                        4. When finished, say <strong>"Save Session"</strong> to get the import code.
                                    </p>
                                </div>
                            </div>

                            <div className="relative group mb-6">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
                                <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm">
                                    <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                                        <span className="text-[10px] font-mono text-gray-400">SYSTEM_PROMPT.md</span>
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Context: {page.title}</span>
                                    </div>
                                    <textarea 
                                        readOnly 
                                        value={prompt}
                                        className="w-full h-48 p-4 text-xs font-mono text-gray-600 bg-transparent resize-none focus:outline-none"
                                    />
                                </div>
                                <button 
                                    onClick={handleCopy}
                                    className="absolute bottom-4 right-4 bg-black text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                                >
                                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                    <span>{isCopied ? 'Copied' : 'Copy Prompt'}</span>
                                </button>
                            </div>

                            <div className="flex justify-end">
                                <button 
                                    onClick={() => setStep('ingest')}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200"
                                >
                                    <span>I have the JSON</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="mb-4">
                                <h3 className="font-bold text-gray-900 mb-1">Import Session Data</h3>
                                <p className="text-xs text-gray-500">Paste the JSON block provided by the external AI to save your progress.</p>
                            </div>

                            <div className="relative mb-6">
                                <textarea 
                                    autoFocus
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder='{ "blocks": [ ... ] }'
                                    className={`w-full h-64 p-4 font-mono text-xs border-2 rounded-xl resize-none focus:outline-none transition-all bg-white text-gray-900 shadow-inner ${error ? 'border-rose-300 focus:border-rose-500' : 'border-gray-200 focus:border-indigo-500'}`}
                                />
                                {error && (
                                    <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur border border-rose-200 text-rose-700 p-3 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm animate-shake">
                                        <AlertCircle className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center">
                                <button onClick={() => setStep('prompt')} className="text-gray-500 hover:text-gray-900 text-sm font-medium">
                                    Back
                                </button>
                                <button 
                                    onClick={handleIngest}
                                    disabled={!jsonInput.trim()}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Import & Save</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
