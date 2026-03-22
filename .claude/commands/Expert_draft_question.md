# Expert Consultation: CRITICAL TipTap Editor Complete Malfunction

## Problem Statement

We have a **CRITICAL TipTap editor issue** that has escalated to complete malfunction:

- **Every single keystroke** breaks to a new line (not just every few keystrokes)
- **Backspace is completely non-functional** - doesn't erase any characters
- The editor is **completely unusable** for any text input

This appears to be a JavaScript/React state management issue rather than just CSS, since our minimal debug editor works perfectly.

## Environment Details

- **Framework**: Next.js 15.3.5 with TypeScript
- **Editor**: TipTap React (@tiptap/react) with multiple extensions
- **Styling**: Tailwind CSS + Custom CSS in globals.css
- **Language Support**: Hebrew RTL + English LTR mixed content
- **Browser**: Testing in modern browsers (Chrome, Safari, Firefox)

## Current TipTap Configuration

```typescript
// File: src/app/(author)/editor/components/TipTapEditor.tsx
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      dropcursor: { color: 'hsl(var(--primary))', width: 2 },
      heading: false,
      hardBreak: false, // DISABLED to prevent forced line breaks
    }),
    Placeholder.configure({
      placeholder: 'התחילו לכתוב את הפרק כאן...',
    }),
    TextAlign.configure({
      types: ['paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
      defaultAlignment: 'right',
    }),
    SearchAndReplace.configure({
      searchResultClass: 'search-result',
      disableRegex: false,
    }),
    Underline,
    Strike,
    Link,
    Highlight,
    CharacterCount,
    // Typography, // DISABLED to prevent automatic text transformations
    Image,
    Table,
    TableRow,
    TableHeader,
    TableCell,
    ListItem,
    OrderedList,
    Footnotes,
    FootnoteReference,
    Footnote,
  ],
  content: value,
  onUpdate: ({ editor }) => onChange(editor.getHTML()),
  editorProps: {
    attributes: {
      class:
        'tiptap-editor focus:outline-none max-w-none p-4 md:p-6 text-right font-sans text-sm leading-relaxed',
      dir: 'rtl',
    },
    // ... other props
  },
});
```

## CSS Applied (Multiple Attempts)

### Current CSS Overrides in globals.css:

```css
/* TipTap Editor Styling - Force Normal Text Flow */
.tiptap-editor {
  color: hsl(var(--foreground));
  white-space: normal !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  hyphens: none !important;
  word-wrap: normal !important;
  word-spacing: normal !important;
  letter-spacing: normal !important;
  text-wrap: wrap !important;
  -webkit-hyphens: none !important;
  -moz-hyphens: none !important;
  -ms-hyphens: none !important;
}

/* Prevent footnote styles from affecting main editor content */
.tiptap-editor .ProseMirror:not(.footnote-item):not(.footnote-item p) {
  word-wrap: normal !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
  white-space: normal !important;
  hyphens: none !important;
  -webkit-hyphens: none !important;
  -moz-hyphens: none !important;
  -ms-hyphens: none !important;
}

/* Enhanced RTL Editor Styling */
.ProseMirror {
  white-space: normal !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  hyphens: none !important;
  word-wrap: normal !important;
  -webkit-hyphens: none !important;
  -moz-hyphens: none !important;
  -ms-hyphens: none !important;
  max-width: none !important;
  width: 100% !important;
}

.ProseMirror p {
  white-space: normal !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  hyphens: none !important;
  word-wrap: normal !important;
  -webkit-hyphens: none !important;
  -moz-hyphens: none !important;
  -ms-hyphens: none !important;
}
```

## Current Critical Behavior

1. **User types**: "This is a test sentence"
2. **Expected**: Text flows normally until edge of container, then wraps
3. **ACTUAL SEVERE ISSUE**: Every single character breaks to new line:

   ```
   T
   h
   i
   s

   i
   s

   a
   ```

4. **Backspace Issue**: Pressing backspace does nothing - characters cannot be deleted
5. **Debug Editor**: A minimal TipTap editor with only StarterKit works perfectly, confirming this is NOT a TipTap core issue

## Previous Attempts to Fix

1. ✅ **Removed `prose` classes** from editor attributes
2. ✅ **Disabled Typography extension** (prevents auto-transformations)
3. ✅ **Disabled hardBreak extension** (prevents Shift+Enter line breaks)
4. ✅ **Added comprehensive CSS overrides** with `!important`
5. ✅ **Scoped footnote CSS** to prevent bleeding into main content
6. ✅ **Disabled all hyphenation** across browsers
7. ✅ **Forced `white-space: normal`** and `word-break: normal`
8. ✅ **Created debug editor** with only StarterKit - THIS WORKS PERFECTLY
9. ❌ **Attempted to fix React state conflicts** - made the issue worse initially, reverted immediately

## Current Suspicions (Updated Based on Severe State)

1. **React State Management Conflict**: Content sanitization or auto-save interfering with TipTap's internal state
2. **Extension Chain Interaction**: Complex interactions between multiple TipTap extensions
3. **Event Handler Hijacking**: Some code intercepting keyboard events and breaking TipTap's normal flow
4. **Context Provider Interference**: AppContext.tsx has content sanitization that might conflict with TipTap updates
5. **Async State Updates**: Debounced operations or React state batching causing editor state corruption

**KEY EVIDENCE**: Since the debug editor (StarterKit only) works perfectly, this is definitely NOT:

- A CSS issue
- A core TipTap problem
- A browser compatibility issue

## URGENT Questions for Expert

**Primary Focus**: This is now a JavaScript/React state management issue, NOT CSS.

1. **React State Conflicts**: What React patterns are known to break TipTap's internal state management? We suspect our content sanitization or auto-save is interfering.

2. **Extension Debugging**: How can we systematically disable TipTap extensions to identify which one is causing the keystroke-level line breaking?

3. **Event Handler Conflicts**: What external event handlers could hijack TipTap's keyboard events and cause this severe malfunction?

4. **ProseMirror State Corruption**: What causes ProseMirror document state to become corrupted where every keystroke creates new paragraphs?

5. **Content Sanitization Timing**: We sanitize content on `updateChapter` - could this interfere with TipTap's `onUpdate` callback and create a feedback loop?

6. **Debug Strategy**: What's the best approach to isolate the exact component/code causing this since we know StarterKit works perfectly?

7. **State Management Anti-patterns**: What React patterns should we avoid when integrating TipTap to prevent state corruption?

## Critical Code Context

**AppContext.tsx updateChapter function that might be causing state conflicts:**

```typescript
const updateChapter = (
  id: string,
  data: Partial<Omit<Chapter, 'id' | 'order'>>
) => {
  // Expert security requirement: sanitize content before state update
  if (data.content !== undefined) {
    const { sanitizeChapterContent } = require('@/lib/sanitizeHTML');
    data.content = sanitizeChapterContent(data.content);
  }

  // Update the specific chapter immediately - no debouncing for content updates
  setChapters(prev => prev.map(ch => (ch.id === id ? { ...ch, ...data } : ch)));
};
```

**TipTap onUpdate callback that calls updateChapter:**

```typescript
onUpdate: ({ editor }) => onChange(editor.getHTML()),
```

**Potential Feedback Loop**: TipTap update → sanitization → state change → possible re-render → TipTap corruption?

## Debugging Information Needed

**Focus on JavaScript/React debugging since CSS is confirmed working:**

- Which React state update pattern is corrupting TipTap's internal state?
- How to identify if content sanitization is creating a feedback loop?
- What TipTap extension combination causes this specific malfunction?
- How to debug ProseMirror document state corruption in real-time?

## URGENT Solution Request

We need to restore basic editor functionality:

- **STOP every keystroke from creating new lines**
- **RESTORE backspace functionality** so characters can be deleted
- **IDENTIFY the React state conflict** that's corrupting TipTap's internal state
- **MAINTAIN** Hebrew RTL support and current formatting features

**CRITICAL**: The editor is completely unusable. Users cannot type any content. This is a production-blocking issue.

## Environment Info

- Running in Docker on port 9002
- Debug editor (StarterKit only) works perfectly at /debug/editor
- Main editor completely broken at author section

Thank you for urgent assistance on this critical production issue!
