const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Extracts raw text from a PDF buffer or file path.
 * @param {Buffer|string} input - PDF buffer or file path
 * @returns {Promise<string>} - Extracted text content
 */
async function extractText(input) {
  try {
    let dataBuffer;
    if (Buffer.isBuffer(input)) {
      dataBuffer = input;
    } else if (typeof input === 'string') {
      if (fs.existsSync(input)) {
        dataBuffer = fs.readFileSync(input);
      } else {
        // If string is raw text content itself, return directly
        return input;
      }
    } else {
      throw new Error("Invalid input provided for text extraction.");
    }

    const pdfData = await pdfParse(dataBuffer);
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error("PDF contains no extractable text.");
    }

    return pdfData.text;
  } catch (error) {
    console.error("Error in extractText module:", error.message);
    throw error;
  }
}

module.exports = { extractText };
