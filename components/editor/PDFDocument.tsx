import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export const PDFDocument = ({
  content,
  filename,
}: {
  content: string;
  filename?: string;
}) => {
  // Hardcoded default settings
  const settings = {
    margin: 55,
    lineSpacing: 1.6,
    fontSize: 14,
  };
  // Simple parser to handle basic markdown-like structure
  const paragraphs = content.split("\n\n").filter(Boolean);
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|_.*?_)/g);
    return parts.map((part, index) => {
      if (part.startsWith("***") && part.endsWith("***")) {
        return (
          <Text key={index} style={{ fontFamily: "Times-BoldItalic" }}>
            {part.slice(3, -3)}
          </Text>
        );
      } else if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <Text key={index} style={{ fontFamily: "Times-Bold" }}>
            {part.slice(2, -2)}
          </Text>
        );
      } else if (
        (part.startsWith("*") && part.endsWith("*")) ||
        (part.startsWith("_") && part.endsWith("_"))
      ) {
        return (
          <Text key={index} style={{ fontFamily: "Times-Italic" }}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      return <Text key={index}>{part}</Text>;
    });
  };

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

  return (
    <Document>
      <Page size="A4" style={dynamicStyles.page}>
        {/* Fixed Header */}
        <Text style={dynamicStyles.headerText} fixed>
          {filename ? `Document: ${filename}` : "Digitized Document"} |{" "}
          {currentDate}
        </Text>

        {/* Content */}
        {paragraphs.map((p, i) => {
          if (p.startsWith("# ")) {
            return (
              <Text key={i} style={dynamicStyles.title}>
                {renderInlineMarkdown(p.replace("# ", ""))}
              </Text>
            );
          }
          if (p.startsWith("## ")) {
            return (
              <Text key={i} style={dynamicStyles.h2}>
                {renderInlineMarkdown(p.replace("## ", ""))}
              </Text>
            );
          }
          if (p.startsWith("### ")) {
            return (
              <Text key={i} style={dynamicStyles.h3}>
                {renderInlineMarkdown(p.replace("### ", ""))}
              </Text>
            );
          }
          if (p.startsWith("- ") || p.startsWith("* ")) {
            const listItems = p.split("\n").filter(Boolean);
            return (
              <View key={i} style={{ marginBottom: settings.fontSize }}>
                {listItems.map((item, j) => (
                  <View key={j} style={dynamicStyles.listItem}>
                    <Text style={dynamicStyles.bulletPoint}>•</Text>
                    <Text style={dynamicStyles.listItemContent}>
                      {renderInlineMarkdown(item.replace(/^[-*]\s/, ""))}
                    </Text>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <Text key={i} style={dynamicStyles.paragraph}>
              {renderInlineMarkdown(p)}
            </Text>
          );
        })}

        {/* Fixed Footer */}
        <Text
          style={dynamicStyles.footerText}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};
