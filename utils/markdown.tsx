import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MarkdownProps {
    content: string;
    className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownProps> = ({ content, className = '' }) => {
    return (
        <div className={`prose prose-indigo max-w-none prose-p:leading-relaxed ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // Override components if necessary for security or styling
                    a: ({ node, ...props }) => <a {...props} className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer" />,
                    p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
                    h1: ({ node, ...props }) => <h1 {...props} className="text-2xl font-bold mt-4 mb-2" />,
                    h2: ({ node, ...props }) => <h2 {...props} className="text-xl font-bold mt-3 mb-2" />,
                    h3: ({ node, ...props }) => <h3 {...props} className="text-lg font-semibold mt-2 mb-1" />,
                    ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-5 mb-2" />,
                    ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-5 mb-2" />,
                    blockquote: ({ node, ...props }) => <blockquote {...props} className="border-l-4 border-gray-200 pl-4 italic my-4" />,
                    code: ({ node, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '')
                        return !match ? (
                            <code className="bg-gray-100 text-red-500 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                                {children}
                            </code>
                        ) : (
                            <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-sm font-mono my-2">
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            </pre>
                        )
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};
