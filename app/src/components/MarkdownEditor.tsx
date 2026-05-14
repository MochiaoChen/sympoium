/**
 * MarkdownEditor — CodeMirror 6 + Markdown，单栏「实时预览」
 *
 * 不再左右分栏。光标所在行依然可见原始 Markdown 标记
 * （#、**、_ 等），但标记被弱化为浅墨色；标题／粗体／斜体
 * 等在编辑过程中即以视觉样式呈现，接近 Obsidian Live Preview 的体验。
 *
 * 设计取舍：
 *   - 不隐藏标记字符（隐藏需要在 cursor-on-line 时切换，会让 IME 中文输入很难处理）。
 *   - 使用 HighlightStyle 给 markdown token 着色／变粗／变大。
 *   - 字体延续会饮规范：正文用 Noto Serif SC，代码用 JetBrains Mono。
 */

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

const symposiumHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '28px', fontWeight: '700', color: '#1C1A18', lineHeight: '1.45' },
  { tag: t.heading2, fontSize: '22px', fontWeight: '700', color: '#1C1A18', lineHeight: '1.5' },
  { tag: t.heading3, fontSize: '19px', fontWeight: '600', color: '#1C1A18', lineHeight: '1.55' },
  { tag: t.heading4, fontSize: '17px', fontWeight: '600', color: '#1C1A18' },
  { tag: t.heading5, fontSize: '16px', fontWeight: '600', color: '#1C1A18' },
  { tag: t.heading6, fontSize: '15px', fontWeight: '600', color: '#4A4641' },
  { tag: t.strong, fontWeight: '700', color: '#1C1A18' },
  { tag: t.emphasis, fontStyle: 'italic', color: '#1C1A18' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#8A847C' },
  { tag: t.link, color: '#5D2A2C', textDecoration: 'underline' },
  { tag: t.url, color: '#8A847C' },
  { tag: t.quote, color: '#4A4641', fontStyle: 'italic' },
  { tag: t.monospace, fontFamily: '"JetBrains Mono", monospace', backgroundColor: '#F4F1EA', color: '#1C1A18' },
  { tag: t.list, color: '#5D2A2C' },
  // 标记字符（# > * _ ` 等）保留可见，但弱化为浅墨色，让正文视觉占主导
  { tag: t.processingInstruction, color: '#C8C0B0' },
  { tag: t.meta, color: '#C8C0B0' },
  { tag: t.contentSeparator, color: '#C8C0B0' },
]);

const symposiumTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: 'transparent',
      color: '#1C1A18',
      fontFamily: '"Noto Serif SC", serif',
      fontSize: '18px',
      lineHeight: '1.75',
      letterSpacing: '0.02em',
    },
    '.cm-scroller': {
      fontFamily: 'inherit',
      lineHeight: 'inherit',
      padding: '24px',
      overflow: 'auto',
    },
    '.cm-content': {
      caretColor: '#5D2A2C',
      padding: 0,
    },
    '.cm-line': {
      padding: '0 2px',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#5D2A2C',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(93, 42, 44, 0.16) !important',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-gutters': {
      display: 'none',
    },
    '.cm-placeholder': {
      color: '#B8B1A5',
      fontStyle: 'normal',
    },
  },
  { dark: false },
);

export default function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const extensions = useMemo(
    () => [
      markdown(),
      syntaxHighlighting(symposiumHighlight),
      symposiumTheme,
      EditorView.lineWrapping,
    ],
    [],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      placeholder={placeholder}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        searchKeymap: false,
        autocompletion: false,
      }}
      style={{ height: '100%' }}
    />
  );
}
