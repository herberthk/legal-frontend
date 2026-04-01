import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useState, useRef } from "react";
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
  ChevronDown,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import { Extension } from "@tiptap/core";

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) =>
              element.style.fontSize.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ chain }: any) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ chain }: any) => {
          return chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});

const EditorSelect = ({
  value,
  onChange,
  options,
  icon: Icon,
  placeholder,
  width = "w-32",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-[#1a1a1a]/5 transition-colors border border-transparent hover:border-[#1a1a1a]/10 ${width}`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {Icon && <Icon className="w-4 h-4 shrink-0 text-[#1a1a1a]/60" />}
          <span className="truncate">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {options.find((o: any) => o.value === value)?.label || placeholder}
          </span>
        </div>
        <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-[#1a1a1a]/10 py-1 z-50 max-h-64 overflow-y-auto">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {options.map((option: any) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-[#1a1a1a]/5 transition-colors ${value === option.value ? "bg-[#1a1a1a]/5 font-medium" : ""}`}
              style={option.style}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const FONT_FAMILIES = [
  { label: "Font Family", value: "" },
  {
    label: "Times New Roman",
    value: '"Times New Roman", Times, serif',
    style: { fontFamily: '"Times New Roman", Times, serif' },
  },
  {
    label: "Helvetica",
    value: "Helvetica, Arial, sans-serif",
    style: { fontFamily: "Helvetica, Arial, sans-serif" },
  },
  {
    label: "Courier",
    value: '"Courier New", Courier, monospace',
    style: { fontFamily: '"Courier New", Courier, monospace' },
  },
];

const FONT_SIZES = [
  { label: "Font Size", value: "" },
  { label: "10pt", value: "10pt" },
  { label: "11pt", value: "11pt" },
  { label: "12pt", value: "12pt" },
  { label: "14pt", value: "14pt" },
  { label: "16pt", value: "16pt" },
  { label: "18pt", value: "18pt" },
  { label: "24pt", value: "24pt" },
];

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

  const currentFontFamily = editor.getAttributes("textStyle").fontFamily || "";
  const currentFontSize = editor.getAttributes("textStyle").fontSize || "";

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-[#1a1a1a]/10 bg-[#f5f2ed]/30 sticky top-0 z-10">
      <div className="flex items-center gap-1 pr-2 border-r border-[#1a1a1a]/10">
        <EditorSelect
          value={currentFontFamily}
          onChange={(val: string) => {
            if (val) editor.chain().focus().setFontFamily(val).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
          options={FONT_FAMILIES}
          icon={Type}
          placeholder="Font"
          width="w-36"
        />
        <EditorSelect
          value={currentFontSize}
          onChange={(val: string) => {
            if (val) editor.chain().focus().setFontSize(val).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
          options={FONT_SIZES}
          placeholder="Size"
          width="w-24"
        />
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-[#1a1a1a]/10">
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
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive({ textAlign: "left" }) ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive({ textAlign: "center" }) ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`p-2 rounded hover:bg-[#1a1a1a]/5 transition-colors ${editor.isActive({ textAlign: "right" }) ? "bg-[#1a1a1a]/10 text-[#1a1a1a]" : "text-[#1a1a1a]/60"}`}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
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
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Markdown.configure({ html: true }),
      TextStyle,
      FontFamily,
      FontSize,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onCreate: ({ editor }) => {
      // Ensure the parent has the HTML version immediately
      onChange(editor.getHTML());
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
          paddingTop: `65pt`,
          paddingBottom: `65pt`,
          paddingLeft: `55pt`,
          paddingRight: `55pt`,
        }}
      >
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
