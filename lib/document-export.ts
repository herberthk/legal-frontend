import { toast } from "sonner";

/**
 * Generates and downloads a .doc file formatted in standard A4 layout,
 * matching the font, line height, margins, and text alignment used in the PDF export.
 *
 * @param content HTML transcription string from the editor
 * @param title Title of the document
 */
export function exportTranscriptionToDoc(content: string, title: string) {
  const finalTitle = title || "Transcription";

  // Build a Word-compatible HTML package with Microsoft-specific schemas and styling.
  const html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${finalTitle}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 595.3pt 841.9pt; /* Standard A4 Dimensions */
      margin: 65.0pt 55.0pt 65.0pt 55.0pt; /* Matching PDF padding margin: 55, top/bottom: 65 */
      mso-header-margin: 30.0pt;
      mso-footer-margin: 30.0pt;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14.0pt;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: transparent;
    }
    h1 {
      font-family: 'Times New Roman', Times, serif;
      font-size: 24.0pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin-top: 0pt;
      margin-bottom: 28.0pt;
      line-height: 1.6;
    }
    h2 {
      font-family: 'Times New Roman', Times, serif;
      font-size: 16.0pt;
      font-weight: bold;
      margin-top: 21.0pt;
      margin-bottom: 11.0pt;
      line-height: 1.6;
    }
    h3 {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14.0pt;
      font-weight: bold;
      margin-top: 14.0pt;
      margin-bottom: 8.0pt;
      line-height: 1.6;
    }
    p {
      margin-top: 0pt;
      margin-bottom: 14.0pt;
      text-align: justify;
      line-height: 1.6;
    }
    ul, ol {
      margin-top: 0pt;
      margin-bottom: 14.0pt;
      padding-left: 20.0pt;
    }
    li {
      margin-bottom: 7.0pt;
      text-align: justify;
      line-height: 1.6;
    }
    strong, b {
      font-weight: bold;
    }
    em, i {
      font-style: italic;
    }
    u {
      text-decoration: underline;
    }
    s, strike, del {
      text-decoration: line-through;
    }
    a {
      color: #0000ff;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="Section1">
    ${content}
  </div>
</body>
</html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeTitle = finalTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  a.download = `scribe-${safeTitle}-${Date.now()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Document exported successfully!");
}
