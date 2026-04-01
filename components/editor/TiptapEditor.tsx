import { useEditor, EditorContent, Editor } from "@tiptap/react";
import { useEffect, useState, useRef, memo, useCallback } from "react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  Strikethrough,
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
        (fontSize: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ chain }: { chain: () => any }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ chain }: { chain: () => any }) => {
          return chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});

interface EditorSelectOption {
  label: string;
  value: string;
  style?: React.CSSProperties;
}

interface EditorSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: EditorSelectOption[];
  icon?: React.ComponentType<{ className?: string }>;
  placeholder: string;
  width?: string;
}

const EditorSelect = memo(
  ({
    value,
    onChange,
    options,
    icon: Icon,
    placeholder,
    width = "w-32",
  }: EditorSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (ref.current && !ref.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Standardize values for matching (ignore quotes)
    const normalize = (v: string) => v.replace(/['"]/g, "").toLowerCase();
    const selectedOption =
      options.find((o) => normalize(o.value) === normalize(value)) ||
      options.find((o) => o.value === "");

    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all border border-indigo-500/5 dark:border-indigo-400/5 hover:border-indigo-500/20 dark:hover:border-indigo-400/20 text-slate-700 dark:text-slate-200 font-medium ${width}`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {Icon && <Icon className="w-4 h-4 shrink-0 text-indigo-500/60" />}
            <span className="truncate">
              {selectedOption?.label || placeholder}
            </span>
          </div>
          <ChevronDown
            className={`w-3 h-3 opacity-50 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-indigo-500/10 dark:border-indigo-400/10 py-2 z-[60] max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in duration-200">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${normalize(value) === normalize(option.value) ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-600 dark:text-slate-300"}`}
                style={option.style}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);

EditorSelect.displayName = "EditorSelect";

const FONT_FAMILIES: EditorSelectOption[] = [
  { label: "Default Font", value: "" },
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

const FONT_SIZES: EditorSelectOption[] = [
  { label: "12pt (Default)", value: "" },
  { label: "10pt", value: "10pt" },
  { label: "11pt", value: "11pt" },
  { label: "12pt", value: "12pt" },
  { label: "14pt", value: "14pt" },
  { label: "16pt", value: "16pt" },
  { label: "18pt", value: "18pt" },
  { label: "24pt", value: "24pt" },
];

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  const [, setUpdateCount] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const handler = () => setUpdateCount((c) => c + 1);
    editor.on("transaction", handler);
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("transaction", handler);
      editor.off("selectionUpdate", handler);
    };
  }, [editor]);

  const toggleLink = useCallback(() => {
    if (!editor) return;
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
  }, [editor]);

  if (!editor) {
    return null;
  }

  const currentFontFamily = editor.getAttributes("textStyle").fontFamily || "";
  const currentFontSize = editor.getAttributes("textStyle").fontSize || "";

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-3 border-b border-indigo-500/10 dark:border-indigo-400/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-20 transition-colors">
      <div className="flex items-center gap-2 pr-3 border-r border-indigo-500/10 dark:border-indigo-400/10">
        <EditorSelect
          value={currentFontFamily}
          onChange={(val: string) => {
            if (val) editor.chain().focus().setFontFamily(val).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
          options={FONT_FAMILIES}
          icon={Type}
          placeholder="Font"
          width="w-40"
        />
        <EditorSelect
          value={currentFontSize}
          onChange={(val: string) => {
            if (val) editor.chain().focus().setFontSize(val).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
          options={FONT_SIZES}
          placeholder="Size"
          width="w-28"
        />
      </div>

      <div className="flex items-center gap-0.5 px-3 border-r border-indigo-500/10 dark:border-indigo-400/10">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("bold") ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400"}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("italic") ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400"}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("strike") ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400"}`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-3 border-r border-indigo-500/10 dark:border-indigo-400/10">
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`px-2.5 py-1.5 rounded-xl text-xs font-black hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("heading", { level: 1 }) ? "bg-indigo-600 dark:bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400"}`}
          title="H1"
        >
          H1
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`px-2.5 py-1.5 rounded-xl text-xs font-black hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("heading", { level: 2 }) ? "bg-indigo-600 dark:bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400"}`}
          title="H2"
        >
          H2
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`px-2.5 py-1.5 rounded-xl text-xs font-black hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("heading", { level: 3 }) ? "bg-indigo-600 dark:bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400"}`}
          title="H3"
        >
          H3
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-3 border-r border-indigo-500/10 dark:border-indigo-400/10">
        <button
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`p-2 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive({ textAlign: "left" }) ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400"}`}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`p-2 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive({ textAlign: "center" }) ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400"}`}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`p-2 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive({ textAlign: "right" }) ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400"}`}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-3 border-r border-indigo-500/10 dark:border-indigo-400/10">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("bulletList") ? "bg-indigo-600 dark:bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400"}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("orderedList") ? "bg-indigo-600 dark:bg-indigo-500 text-white" : "text-slate-500 dark:text-slate-400"}`}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-3">
        <button
          onClick={toggleLink}
          className={`p-2 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all ${editor.isActive("link") ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400"}`}
          title="Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive("link")}
          className={`p-2 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-all disabled:opacity-30 disabled:hover:bg-transparent ${editor.isActive("link") ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}
          title="Unlink"
        >
          <Unlink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

MenuBar.displayName = "MenuBar";

export function TiptapEditor({
  content,
  onChange,
  readOnly = false,
}: {
  content: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
}) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onChange(editor.getHTML());
      }, 500); // 500ms debounce
    },
    editorProps: {
      attributes: {
        class:
          "pdf-preview-styles focus:outline-none min-h-[600px] transition-colors p-8 md:p-12",
        style: "color: inherit;",
      },
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`flex flex-col w-full max-w-5xl mx-auto shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-indigo-500/10 dark:border-indigo-400/10 h-full transition-all group`}
    >
      {!readOnly && <MenuBar editor={editor} />}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <EditorContent
          editor={editor}
          className="h-full min-h-[600px] text-slate-900 dark:text-slate-100"
        />
      </div>
    </div>
  );
}
