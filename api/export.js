import { marked } from "marked";
import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel
} from "docx";
import JSZip from "jszip";


export default async function handler(
  req,
  res
) {

  if (
    req.method !== "POST"
  ) {

    return res.status(405).json({
      error:
        "Method not allowed"
    });

  }


  try {

    const {
      format,
      topic,
      content
    } = req.body || {};


    if (!content) {

      return res.status(400).json({
        error:
          "No content available for export."
      });

    }


    const safeName =
      slugify(
        topic ||
        "ezerv-forge-content"
      );


    /* =====================================================
       MARKDOWN
    ===================================================== */

    if (
      format === "md"
    ) {

      res.setHeader(
        "Content-Type",
        "text/markdown; charset=utf-8"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}.md"`
      );


      return res
        .status(200)
        .send(
          content
        );

    }


    /* =====================================================
       HTML
    ===================================================== */

    if (
      format === "html"
    ) {

      const html =
        createHTML(
          topic,
          content
        );


      res.setHeader(
        "Content-Type",
        "text/html; charset=utf-8"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}.html"`
      );


      return res
        .status(200)
        .send(
          html
        );

    }


    /* =====================================================
       PDF
    ===================================================== */

    if (
      format === "pdf"
    ) {

      const pdf =
        await createPDF(
          topic,
          content
        );


      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}.pdf"`
      );


      return res
        .status(200)
        .send(
          pdf
        );

    }


    /* =====================================================
       WORD
    ===================================================== */

    if (
      format === "docx"
    ) {

      const docx =
        await createDOCX(
          topic,
          content
        );


      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}.docx"`
      );


      return res
        .status(200)
        .send(
          docx
        );

    }


    /* =====================================================
       ALL FORMATS
    ===================================================== */

    if (
      format === "all"
    ) {

      const zip =
        new JSZip();


      zip.file(
        `${safeName}.md`,
        content
      );


      zip.file(
        `${safeName}.html`,
        createHTML(
          topic,
          content
        )
      );


      const pdf =
        await createPDF(
          topic,
          content
        );


      zip.file(
        `${safeName}.pdf`,
        pdf
      );


      const docx =
        await createDOCX(
          topic,
          content
        );


      zip.file(
        `${safeName}.docx`,
        docx
      );


      const zipBuffer =
        await zip.generateAsync({
          type:
            "nodebuffer"
        });


      res.setHeader(
        "Content-Type",
        "application/zip"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}-all-formats.zip"`
      );


      return res
        .status(200)
        .send(
          zipBuffer
        );

    }


    return res.status(400).json({
      error:
        "Unsupported export format."
    });


  } catch (error) {

    console.error(
      "Export error:",
      error
    );


    return res.status(500).json({
      error:
        error.message ||
        "Export failed."
    });

  }

}


/* =========================================================
   HTML EXPORT
========================================================= */

function createHTML(
  topic,
  markdown
) {

  const rendered =
    marked.parse(
      markdown
    );


  return `<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>${escapeHTML(topic)}</title>

<style>

body {

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  max-width:
    900px;

  margin:
    0 auto;

  padding:
    50px 30px;

  color:
    #172033;

  line-height:
    1.7;
}

h1 {
  font-size:
    36px;
}

h2 {
  margin-top:
    40px;
}

h3 {
  margin-top:
    30px;
}

table {

  width:
    100%;

  border-collapse:
    collapse;

  margin:
    20px 0;
}

th,
td {

  border:
    1px solid #cbd5e1;

  padding:
    10px;

  text-align:
    left;
}

th {
  background:
    #f1f5f9;
}

pre {

  background:
    #f1f5f9;

  padding:
    15px;

  border-radius:
    8px;

  overflow-x:
    auto;
}

blockquote {

  border-left:
    4px solid #2563eb;

  padding-left:
    15px;

  color:
    #475569;
}

img {
  max-width:
    100%;
}

</style>

</head>

<body>

<h1>
${escapeHTML(topic)}
</h1>

${rendered}

</body>

</html>`;

}


/* =========================================================
   PDF
========================================================= */

function createPDF(
  topic,
  content
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const doc =
        new PDFDocument({
          margin:
            50
        });


      const chunks = [];


      doc.on(
        "data",
        chunk =>
          chunks.push(
            chunk
          )
      );


      doc.on(
        "end",
        () =>
          resolve(
            Buffer.concat(
              chunks
            )
          )
      );


      doc.on(
        "error",
        reject
      );


      doc
        .font(
          "Helvetica-Bold"
        )
        .fontSize(
          24
        )
        .text(
          topic ||
          "EZERV Forge Content"
        );


      doc.moveDown();


      doc
        .font(
          "Helvetica"
        )
        .fontSize(
          10
        )
        .fillColor(
          "#64748b"
        )
        .text(
          "Generated by EZERV Forge"
        );


      doc.moveDown(2);


      doc
        .fillColor(
          "#111827"
        )
        .font(
          "Helvetica"
        )
        .fontSize(
          11
        );


      const lines =
        String(content)
          .replace(
            /\r/g,
            ""
          )
          .split(
            "\n"
          );


      for (
        const line of lines
      ) {

        const text =
          line.trim();


        if (!text) {

          doc.moveDown(
            0.5
          );

          continue;

        }


        if (
          text.startsWith(
            "# "
          )
        ) {

          doc
            .font(
              "Helvetica-Bold"
            )
            .fontSize(
              18
            )
            .text(
              stripMarkdown(
                text.substring(
                  2
                )
              )
            );

          doc.moveDown(
            0.5
          );

          doc
            .font(
              "Helvetica"
            )
            .fontSize(
              11
            );

          continue;

        }


        if (
          text.startsWith(
            "## "
          )
        ) {

          doc
            .font(
              "Helvetica-Bold"
            )
            .fontSize(
              15
            )
            .text(
              stripMarkdown(
                text.substring(
                  3
                )
              )
            );

          doc.moveDown(
            0.3
          );

          doc
            .font(
              "Helvetica"
            )
            .fontSize(
              11
            );

          continue;

        }


        if (
          text.startsWith(
            "### "
          )
        ) {

          doc
            .font(
              "Helvetica-Bold"
            )
            .fontSize(
              13
            )
            .text(
              stripMarkdown(
                text.substring(
                  4
                )
              )
            );

          doc.moveDown(
            0.2
          );

          doc
            .font(
              "Helvetica"
            )
            .fontSize(
              11
            );

          continue;

        }


        if (
          text.startsWith(
            "- "
          )
        ) {

          doc.text(
            `• ${stripMarkdown(
              text.substring(
                2
              )
            )}`
          );

          continue;

        }


        /*
         * Visual placeholders become
         * readable boxes in the PDF.
         */

        if (
          /^\[(INFOGRAPHIC|CHART|DIAGRAM|TABLE):/i
            .test(text)
        ) {

          doc
            .font(
              "Helvetica-Bold"
            )
            .text(
              stripMarkdown(
                text
              )
            );

          doc
            .font(
              "Helvetica"
            );

          continue;

        }


        doc.text(
          stripMarkdown(
            text
          )
        );

      }


      doc.end();

    }
  );

}


/* =========================================================
   DOCX
========================================================= */

async function createDOCX(
  topic,
  content
) {

  const children = [];


  children.push(
    new Paragraph({

      text:
        topic ||
        "EZERV Forge Content",

      heading:
        HeadingLevel.TITLE

    })
  );


  const lines =
    String(content)
      .replace(
        /\r/g,
        ""
      )
      .split(
        "\n"
      );


  for (
    const line of lines
  ) {

    const text =
      line.trim();


    if (!text) {

      children.push(
        new Paragraph({
          text: ""
        })
      );

      continue;

    }


    if (
      text.startsWith(
        "### "
      )
    ) {

      children.push(
        new Paragraph({

          text:
            stripMarkdown(
              text.substring(
                4
              )
            ),

          heading:
            HeadingLevel.HEADING_3

        })
      );

      continue;

    }


    if (
      text.startsWith(
        "## "
      )
    ) {

      children.push(
        new Paragraph({

          text:
            stripMarkdown(
              text.substring(
                3
              )
            ),

          heading:
            HeadingLevel.HEADING_2

        })
      );

      continue;

    }


    if (
      text.startsWith(
        "# "
      )
    ) {

      children.push(
        new Paragraph({

          text:
            stripMarkdown(
              text.substring(
                2
              )
            ),

          heading:
            HeadingLevel.HEADING_1

        })
      );

      continue;

    }


    children.push(
      new Paragraph({

        text:
          stripMarkdown(
            text
          )

      })
    );

  }


  const document =
    new Document({

      sections: [
        {
          properties: {},

          children
        }
      ]

    });


  return Packer.toBuffer(
    document
  );

}


/* =========================================================
   HELPERS
========================================================= */

function stripMarkdown(
  text
) {

  return String(text)

    .replace(
      /\*\*(.*?)\*\*/g,
      "$1"
    )

    .replace(
      /\*(.*?)\*/g,
      "$1"
    )

    .replace(
      /`(.*?)`/g,
      "$1"
    )

    .replace(
      /\[(.*?)\]\(.*?\)/g,
      "$1"
    );

}


function escapeHTML(
  text
) {

  return String(text || "")

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


function slugify(
  text
) {

  return String(text || "")

    .toLowerCase()

    .replace(
      /[^a-z0-9]+/g,
      "-"
    )

    .replace(
      /^-+|-+$/g,
      ""
    )

    .substring(
      0,
      80
    );

}