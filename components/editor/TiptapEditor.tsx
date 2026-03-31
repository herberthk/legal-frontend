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
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
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
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-[#1a1a1a]/10 bg-[#f5f2ed]/30 sticky top-0 z-10">
      <div className="flex items-center gap-1 pr-2 border-r border-[#1a1a1a]/10">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive("bold") ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive("italic") ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive("strike") ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-[#1a1a1a]/10">
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive("heading", { level: 1 }) ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive("heading", { level: 2 }) ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive("heading", { level: 3 }) ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-[#1a1a1a]/10">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive("bulletList") ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive("orderedList") ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 pl-2">
        <button
          onClick={toggleLink}
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive("link") ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive("link")}
          className="p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors text-[#1a1a1a]/60 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Unlink"
        >
          <Unlink className="w-4 h-4" />
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
        class: "pdf-preview-styles focus:outline-none min-h-full",
        style: `font-size: inherit; line-height: inherit;`,
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
      className={`flex flex-col w-full max-w-3xl mx-auto shadow-md rounded-xl overflow-hidden bg-white border border-[#1a1a1a]/10 h-full`}
    >
      {!readOnly && <MenuBar editor={editor} />}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: `55px`,
          fontSize: `14px`,
          lineHeight: 1.6,
        }}
      >
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
