import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const toggleLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    if (previousUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const url = window.prompt("URL");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-indigo-500/10 dark:border-indigo-400/10 bg-indigo-50/30 dark:bg-indigo-950/30 sticky top-0 z-10 transition-colors">
      <div className="flex items-center gap-1 pr-2 border-r border-indigo-500/10 dark:border-indigo-400/10">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded-lg hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("bold") ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" : "text-indigo-950/40 dark:text-indigo-100/40"}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded-lg hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("italic") ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" : "text-indigo-950/40 dark:text-indigo-100/40"}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded-lg hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("strike") ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" : "text-indigo-950/40 dark:text-indigo-100/40"}`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-indigo-500/10 dark:border-indigo-400/10">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded-lg hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("heading", { level: 1 }) ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" : "text-indigo-950/40 dark:text-indigo-100/40"}`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded-lg hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("heading", { level: 2 }) ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" : "text-indigo-950/40 dark:text-indigo-100/40"}`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-indigo-500/10 dark:border-indigo-400/10">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded-lg hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("bulletList") ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" : "text-indigo-950/40 dark:text-indigo-100/40"}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded-lg hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("orderedList") ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" : "text-indigo-950/40 dark:text-indigo-100/40"}`}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 pl-2">
        <button
          onClick={toggleLink}
          className={`p-2 rounded-lg hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("link") ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" : "text-indigo-950/40 dark:text-indigo-100/40"}`}
          title="Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export function TiptapEditor({
  content,
  onChange,
  readOnly = false,
}: {
  content: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Markdown],
    content,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((editor.storage as any).markdown.getMarkdown());
    },
    editorProps: {
      attributes: {
        class: "pdf-preview-styles focus:outline-none min-h-full transition-colors",
        style: "color: inherit;", // Ensure it inherits the foreground color
      },
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  return (
    <div
      className={`flex flex-col w-full max-w-5xl mx-auto shadow-2xl rounded-2xl overflow-hidden bg-white dark:bg-[#0a0a0a] border border-indigo-500/10 dark:border-indigo-400/10 h-full transition-all group`}
    >
      {!readOnly && <MenuBar editor={editor} />}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar dark:text-indigo-50"
        style={{
          padding: "40px md:80px", // Adjusted for better dimensions
          fontSize: "14px",
          lineHeight: 1.6,
        }}
      >
        <EditorContent editor={editor} className="h-full min-h-[600px] text-indigo-950 dark:text-indigo-50" />
      </div>
    </div>
  );
}

