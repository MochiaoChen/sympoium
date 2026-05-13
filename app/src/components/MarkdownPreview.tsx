/**
 * MarkdownPreview — Act 4 实时预览
 *
 * 把 textarea 的 draft 渲染成知乎风格的 HTML 预览。
 * 支持 GFM (表格、删除线、自动链接、任务列表)。
 * 样式手写以匹配整体米色 + 衬线美学。
 */

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownPreviewProps {
  source: string;
}

// All elements styled in serif Chinese; spacing aimed at long-form reading.
const components: Components = {
  h1: ({ children }) => (
    <h1
      className="font-serif font-bold"
      style={{ color: '#1C1A18', fontSize: 26, lineHeight: 1.4, margin: '1.4em 0 0.6em', letterSpacing: '0.02em' }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="font-serif font-bold"
      style={{ color: '#1C1A18', fontSize: 21, lineHeight: 1.45, margin: '1.3em 0 0.5em', letterSpacing: '0.02em' }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="font-serif font-bold"
      style={{ color: '#1C1A18', fontSize: 17, lineHeight: 1.5, margin: '1.2em 0 0.4em' }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      className="font-serif"
      style={{ color: '#1C1A18', fontSize: 15, lineHeight: 1.85, letterSpacing: '0.02em', margin: '0.85em 0' }}
    >
      {children}
    </p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#5D2A2C', textDecoration: 'underline', textUnderlineOffset: 3 }}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: '#1C1A18' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ fontStyle: 'italic', color: '#4A4641' }}>{children}</em>
  ),
  ul: ({ children }) => (
    <ul style={{ listStyle: 'disc', paddingLeft: 22, margin: '0.6em 0', color: '#1C1A18' }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ listStyle: 'decimal', paddingLeft: 22, margin: '0.6em 0', color: '#1C1A18' }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="font-serif" style={{ fontSize: 15, lineHeight: 1.8, margin: '0.25em 0' }}>
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="font-serif"
      style={{
        margin: '0.9em 0',
        padding: '0.4em 0 0.4em 1em',
        borderLeft: '3px solid #D9B88E',
        color: '#4A4641',
        fontStyle: 'italic',
        backgroundColor: '#FBF9F3',
      }}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    // Inline code (no language class) vs fenced code block.
    const isInline = !className?.startsWith('language-');
    if (isInline) {
      return (
        <code
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 13,
            padding: '0.1em 0.4em',
            borderRadius: 3,
            backgroundColor: '#F0EBE0',
            color: '#5D2A2C',
          }}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={className}
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 13,
          color: '#1C1A18',
          lineHeight: 1.6,
        }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre
      style={{
        backgroundColor: '#1C1A18',
        color: '#E8E3D8',
        padding: '0.9em 1em',
        borderRadius: 6,
        margin: '1em 0',
        overflowX: 'auto',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {children}
    </pre>
  ),
  hr: () => (
    <hr style={{ margin: '1.5em 0', borderTop: '1px solid #E8E3D8', borderBottom: 'none' }} />
  ),
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '1em 0' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 14,
          fontFamily: '"Noto Serif SC", serif',
        }}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      style={{
        textAlign: 'left',
        padding: '0.5em 0.8em',
        borderBottom: '2px solid #1C1A18',
        backgroundColor: '#FBF9F3',
        color: '#1C1A18',
        fontWeight: 700,
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      style={{
        padding: '0.5em 0.8em',
        borderBottom: '1px solid #E8E3D8',
        color: '#1C1A18',
      }}
    >
      {children}
    </td>
  ),
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt}
      style={{ maxWidth: '100%', borderRadius: 4, margin: '1em 0', border: '1px solid #E8E3D8' }}
      referrerPolicy="no-referrer"
    />
  ),
};

export default function MarkdownPreview({ source }: MarkdownPreviewProps) {
  // useMemo so we re-render only when source changes, not on every parent render.
  const content = useMemo(() => {
    if (!source.trim()) return null;
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    );
  }, [source]);

  if (!content) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <p className="text-caption font-serif mb-2" style={{ color: '#4A4641' }}>
          预览暂时为空
        </p>
        <p className="text-micro font-sans" style={{ color: '#8A847C', lineHeight: 1.7 }}>
          在左边写一点东西，<br />
          这里会实时渲染成知乎排版样式
        </p>
      </div>
    );
  }

  return <div className="px-6 py-5">{content}</div>;
}
