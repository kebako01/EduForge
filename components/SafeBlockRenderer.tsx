
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Block } from '../types';
import { blockRegistry } from '../blockDefinitions';
import { AlertTriangle, Terminal, RefreshCw } from 'lucide-react';

interface Props {
    block: Block;
    pageId?: string; // Allow passing pageId for DB updates
    onRegenerate?: () => void; // Callback to trigger AI Repair/Regeneration
    onAutoCreate?: (topic: string, context: string, blueprint?: string, onCreated?: (pageId: string) => Promise<void>) => void; // Callback for Curriculum Hole Filling
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class SafeBlockRenderer extends Component<Props, State> {
    // Explicitly declare props to avoid TS errors in some environments where Component inheritance inference fails
    public readonly props: Readonly<Props> & Readonly<{ children?: ReactNode }>;

    state: State = {
        hasError: false,
        error: null
    };

    constructor(props: Props) {
        super(props);
        this.props = props;
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Block Render Error:", error, errorInfo);
        // In a real app, log to a local 'error' table in Dexie
    }

    render(): ReactNode {
        if (this.state.hasError) {
            // Defensive Rendering: Fallback UI with Repair Option
            return (
                <div className="p-4 my-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 flex flex-col space-y-3">
                    <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 overflow-hidden">
                            <h4 className="font-semibold text-sm">Block Rendering Failed</h4>
                            <p className="text-xs mt-1 text-rose-600">The content format from the AI was invalid.</p>
                            <details className="mt-2 text-xs">
                                <summary className="cursor-pointer font-mono hover:text-rose-900">Raw Data</summary>
                                <pre className="mt-2 bg-rose-100 p-2 rounded overflow-auto font-mono text-rose-800">
                                    {JSON.stringify(this.props.block, null, 2)}
                                </pre>
                            </details>
                        </div>
                    </div>
                    
                    {/* Repair Button - Reuses Automation Studio */}
                    {this.props.onRegenerate && (
                        <button 
                            onClick={this.props.onRegenerate}
                            className="self-end flex items-center space-x-2 bg-white border border-rose-200 text-rose-700 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm hover:bg-rose-100 transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Repair with AI</span>
                        </button>
                    )}
                </div>
            );
        }

        const { block, pageId, onAutoCreate } = this.props;
        const definition = blockRegistry.get(block.type);

        // Fallback for unknown types (defined in code but not registry)
        if (!definition) {
            return (
                <div className="p-4 my-4 border border-gray-300 border-dashed rounded bg-gray-50 flex items-center justify-between text-gray-500 font-mono text-sm">
                    <div className="flex items-center">
                        <Terminal className="w-4 h-4 mr-2" />
                        Unknown block type: "{block.type}"
                    </div>
                    {this.props.onRegenerate && (
                        <button 
                            onClick={this.props.onRegenerate}
                            className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Regenerate</span>
                        </button>
                    )}
                </div>
            );
        }

        const { Component: BlockComponent, sanitize } = definition;

        try {
            // Runtime Sanitization: Ensure data matches schema before passing to UI
            const cleanData = sanitize(block);
            // Pass pageId to the component so it can perform DB updates
            return <BlockComponent data={cleanData} pageId={pageId} onAutoCreate={onAutoCreate} />;
        } catch (e) {
            // Handle sanitization errors by displaying the error UI directly
            return (
                <div className="p-4 my-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 flex flex-col space-y-3">
                    <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 overflow-hidden">
                            <h4 className="font-semibold text-sm">Data Integrity Error</h4>
                            <p className="text-xs mt-1 text-rose-600">Sanitization failed: {(e as Error).message}</p>
                            <details className="mt-2 text-xs">
                                <summary className="cursor-pointer font-mono hover:text-rose-900">Raw Data</summary>
                                <pre className="mt-2 bg-rose-100 p-2 rounded overflow-auto font-mono text-rose-800">
                                    {JSON.stringify(this.props.block, null, 2)}
                                </pre>
                            </details>
                        </div>
                    </div>
                     {/* Repair Button - Reuses Automation Studio */}
                     {this.props.onRegenerate && (
                        <button 
                            onClick={this.props.onRegenerate}
                            className="self-end flex items-center space-x-2 bg-white border border-rose-200 text-rose-700 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm hover:bg-rose-100 transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Repair with AI</span>
                        </button>
                    )}
                </div>
            );
        }
    }
}

export default SafeBlockRenderer;
