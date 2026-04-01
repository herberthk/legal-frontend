import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";

export const PDFDocument = ({
  content,
  filename,
  headerText,
  footerText,
  showPageNumbers = true,
  pageNumberPosition = "bottom-center",
}: {
  content: string;
  filename?: string;
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
  pageNumberPosition?:
    | "bottom-center"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "top-right"
    | "top-left"
    | string;
}) => {
  // Hardcoded default settings
  const settings = {
    margin: 55,
    lineSpacing: 1.6,
    fontSize: 14,
  };
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const defaultHeader = `${filename ? `${filename}` : "Digitized Document"} | ${currentDate}`;

  const dynamicStyles = StyleSheet.create({
    page: {
      paddingTop: settings.margin + 10,
      paddingBottom: settings.margin + 10,
      paddingHorizontal: settings.margin,
      fontFamily: "Times-Roman",
      fontSize: settings.fontSize,
      lineHeight: settings.lineSpacing,
      color: "#1a1a1a",
    },
    headerText: {
      position: "absolute",
      top: 30,
      left: settings.margin,
      right: settings.margin,
      fontSize: 9,
      fontFamily: "Helvetica",
      color: "#666666",
      textAlign: "right",
      borderBottomWidth: 1,
      borderBottomColor: "#e5e5e5",
      paddingBottom: 5,
    },
    footerText: {
      position: "absolute",
      bottom: 30,
      left: settings.margin,
      right: settings.margin,
      fontSize: 9,
      fontFamily: "Helvetica",
      color: "#666666",
      textAlign: "center",
      borderTopWidth: 1,
      borderTopColor: "#e5e5e5",
      paddingTop: 5,
    },
    title: {
      fontFamily: "Times-Bold",
      fontSize: settings.fontSize + 10,
      marginBottom: settings.fontSize * 2,
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    h2: {
      fontFamily: "Times-Bold",
      fontSize: settings.fontSize + 2,
      marginTop: settings.fontSize * 1.5,
      marginBottom: settings.fontSize * 0.8,
    },
    h3: {
      fontFamily: "Times-Bold",
      fontSize: settings.fontSize,
      marginTop: settings.fontSize,
      marginBottom: settings.fontSize * 0.6,
    },
    paragraph: {
      marginBottom: settings.fontSize,
      textAlign: "justify",
    },
    listItem: {
      flexDirection: "row",
      marginBottom: settings.fontSize * 0.5,
      paddingLeft: 10,
    },
    bulletPoint: {
      width: 15,
      fontSize: settings.fontSize,
    },
    listItemContent: {
      flex: 1,
      textAlign: "justify",
    },
  });

  const getPageNumberStyle = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base: any = {
      position: "absolute",
      fontSize: 9,
      fontFamily: "Helvetica",
      color: "#666666",
      left: settings.margin,
      right: settings.margin,
    };

    if (pageNumberPosition.startsWith("top")) {
      base.top = 15;
    } else {
      base.bottom = 15;
    }

    if (pageNumberPosition.endsWith("left")) {
      base.textAlign = "left";
    } else if (pageNumberPosition.endsWith("right")) {
      base.textAlign = "right";
    } else {
      base.textAlign = "center";
    }

    return base;
  };

  const renderHTML = (htmlContent: string) => {
    if (typeof window === "undefined") {
      return <Text>{htmlContent.replace(/<[^>]*>?/gm, "")}</Text>;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    let keyCounter = 0;

    const parseNode = (
      node: ChildNode,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inheritedStyles: any = {},
      listContext?: { type: "ul" | "ol"; index: number },
    ): React.ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (!text) return null;
        return (
          <Text key={keyCounter++} style={inheritedStyles}>
            {text}
          </Text>
        );
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        const newStyles = { ...inheritedStyles };

        // Handle inline styles
        const fontFamily = el.style.fontFamily;
        const fontSize = el.style.fontSize;
        const textAlign = el.style.textAlign;

        if (fontFamily) {
          const family = fontFamily.toLowerCase();
          const isBold = newStyles.fontFamily?.includes("Bold");
          const isItalic =
            newStyles.fontFamily?.includes("Italic") ||
            newStyles.fontFamily?.includes("Oblique");

          if (family.includes("times") || family.includes("serif")) {
            newStyles.fontFamily =
              isBold && isItalic
                ? "Times-BoldItalic"
                : isBold
                  ? "Times-Bold"
                  : isItalic
                    ? "Times-Italic"
                    : "Times-Roman";
          } else if (family.includes("courier") || family.includes("mono")) {
            newStyles.fontFamily =
              isBold && isItalic
                ? "Courier-BoldOblique"
                : isBold
                  ? "Courier-Bold"
                  : isItalic
                    ? "Courier-Oblique"
                    : "Courier";
          } else {
            newStyles.fontFamily =
              isBold && isItalic
                ? "Helvetica-BoldOblique"
                : isBold
                  ? "Helvetica-Bold"
                  : isItalic
                    ? "Helvetica-Oblique"
                    : "Helvetica";
          }
        }

        if (fontSize) {
          const parsedSize = parseInt(fontSize);
          if (!isNaN(parsedSize)) {
            newStyles.fontSize = parsedSize;
          }
        }

        if (textAlign) {
          newStyles.textAlign = textAlign;
        }

        // Handle tags
        if (tagName === "strong" || tagName === "b") {
          if (newStyles.fontFamily?.startsWith("Courier")) {
            newStyles.fontFamily = newStyles.fontFamily.includes("Oblique")
              ? "Courier-BoldOblique"
              : "Courier-Bold";
          } else if (newStyles.fontFamily?.startsWith("Helvetica")) {
            newStyles.fontFamily = newStyles.fontFamily.includes("Oblique")
              ? "Helvetica-BoldOblique"
              : "Helvetica-Bold";
          } else {
            newStyles.fontFamily = newStyles.fontFamily?.includes("Italic")
              ? "Times-BoldItalic"
              : "Times-Bold";
          }
        } else if (tagName === "em" || tagName === "i") {
          if (newStyles.fontFamily?.startsWith("Courier")) {
            newStyles.fontFamily = newStyles.fontFamily.includes("Bold")
              ? "Courier-BoldOblique"
              : "Courier-Oblique";
          } else if (newStyles.fontFamily?.startsWith("Helvetica")) {
            newStyles.fontFamily = newStyles.fontFamily.includes("Bold")
              ? "Helvetica-BoldOblique"
              : "Helvetica-Oblique";
          } else {
            newStyles.fontFamily = newStyles.fontFamily?.includes("Bold")
              ? "Times-BoldItalic"
              : "Times-Italic";
          }
        } else if (
          tagName === "s" ||
          tagName === "strike" ||
          tagName === "del"
        ) {
          newStyles.textDecoration = "line-through";
        }

        if (tagName === "ul" || tagName === "ol") {
          let liIndex = 1;
          const children = Array.from(node.childNodes).map((child) => {
            if (
              child.nodeType === Node.ELEMENT_NODE &&
              (child as HTMLElement).tagName.toLowerCase() === "li"
            ) {
              return parseNode(child, newStyles, {
                type: tagName as "ul" | "ol",
                index: liIndex++,
              });
            }
            return parseNode(child, newStyles);
          });
          return (
            <View
              key={keyCounter++}
              style={{ marginBottom: settings.fontSize }}
            >
              {children}
            </View>
          );
        }

        const children = Array.from(node.childNodes).map((child) =>
          parseNode(child, newStyles),
        );

        if (tagName === "p") {
          return (
            <Text
              key={keyCounter++}
              style={[dynamicStyles.paragraph, newStyles]}
            >
              {children}
            </Text>
          );
        } else if (tagName === "h1") {
          return (
            <Text key={keyCounter++} style={[dynamicStyles.title, newStyles]}>
              {children}
            </Text>
          );
        } else if (tagName === "h2") {
          return (
            <Text key={keyCounter++} style={[dynamicStyles.h2, newStyles]}>
              {children}
            </Text>
          );
        } else if (tagName === "h3") {
          return (
            <Text key={keyCounter++} style={[dynamicStyles.h3, newStyles]}>
              {children}
            </Text>
          );
        } else if (tagName === "li") {
          const prefix =
            listContext?.type === "ol" ? `${listContext.index}.` : "•";
          return (
            <View key={keyCounter++} style={dynamicStyles.listItem}>
              <Text style={dynamicStyles.bulletPoint}>{prefix}</Text>
              <Text style={[dynamicStyles.listItemContent, newStyles]}>
                {children}
              </Text>
            </View>
          );
        } else if (tagName === "a") {
          const href = el.getAttribute("href");
          return (
            <Link
              key={keyCounter++}
              src={href || ""}
              style={[
                newStyles,
                { color: "blue", textDecoration: "underline" },
              ]}
            >
              {children}
            </Link>
          );
        } else if (
          tagName === "span" ||
          tagName === "strong" ||
          tagName === "em" ||
          tagName === "s" ||
          tagName === "strike" ||
          tagName === "del"
        ) {
          return (
            <Text key={keyCounter++} style={newStyles}>
              {children}
            </Text>
          );
        } else {
          // Fallback for other elements (like div)
          return (
            <View key={keyCounter++} style={newStyles}>
              {children}
            </View>
          );
        }
      }
      return null;
    };

    return Array.from(doc.body.childNodes).map((child) => parseNode(child));
  };

  return (
    <Document title={filename || "Digitized Document"}>
      <Page size="A4" style={dynamicStyles.page}>
        {/* Fixed Header */}
        <Text style={dynamicStyles.headerText} fixed>
          {headerText !== undefined ? headerText : defaultHeader}
        </Text>

        {/* Content */}
        {renderHTML(content)}

        {/* Fixed Footer */}
        {footerText && (
          <Text style={dynamicStyles.footerText} fixed>
            {footerText}
          </Text>
        )}

        {/* Page Numbers */}
        {showPageNumbers && (
          <Text
            style={getPageNumberStyle()}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
            fixed
          />
        )}
      </Page>
    </Document>
  );
};
