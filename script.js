import Doczilla from "@doczilla/node";
import fs from "fs/promises";

// limit 250 times per month
const doczilla = new Doczilla("doczilla-fZS3bKQiOJ1KxoAE3CZr5");

async function generatePDF() {
  try {
    const htmlContent = await fs.readFile("index.html", "utf-8");

    const pdf = await doczilla.pdf.direct({
      page: {
        html: htmlContent,
      },
      pdf: {
        margin: {
          top: "60px",
          bottom: "50px",
        },
      },
    });

    await fs.writeFile("cv.pdf", pdf);

    console.log("PDF generated successfully: cv.pdf");
  } catch (error) {
    console.error("Error generating PDF:", error);
  }
}

generatePDF();
