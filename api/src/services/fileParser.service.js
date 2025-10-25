// api/src/services/fileParser.service.js
const fs = require("fs");
const path = require("path");
const PDFParser = require("pdf2json");          // CommonJS-compatible PDF parser
const { parse } = require("csv-parse/sync");

/**
 * Parse an uploaded file or OCR text into financial fields.
 * Returns normalized fields: { Date, Source, Category, Amount, Method, Notes, Type }
 */
async function parseFile(absPath, mimeType, ocrText = "") {
  let rawText = "";

  try {
    const ext = path.extname(absPath).toLowerCase();

    if (mimeType === "application/pdf" || ext === ".pdf") {
      rawText = await parsePDF(absPath);
      if (!rawText && ocrText) rawText = ocrText;
    } else if (mimeType.startsWith("text/") || ext === ".txt") {
      rawText = fs.readFileSync(absPath, "utf8");
    } else if (mimeType.includes("csv") || ext === ".csv") {
      return parseCSVFile(absPath);
    } else if (ocrText) {
      rawText = ocrText;
    } else {
      return null; // unsupported file
    }
  } catch (err) {
    console.error("File parsing failed:", err);
    return null;
  }

  const text = (rawText || "").replace(/\r\n/g, "\n").trim();
  if (!text) return null;

  // Try structured key-value parsing first
  const keyValueResult = parseKeyValueText(text);

  // Merge with regex-based extraction for missing fields
  const result = {
    Date: keyValueResult.Date || extractDate(text),
    Source: keyValueResult.Source || extractSource(text),
    Category: keyValueResult.Category || extractCategory(text),
    Amount: keyValueResult.Amount || extractAmount(text),
    Method: keyValueResult.Method || extractMethod(text),
    Notes: keyValueResult.Notes || extractNotes(text),
    Type: keyValueResult.Type || "expense",
  };

  return result;
}

/* ---------- PDF Parsing Helper ---------- */
function parsePDF(absPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataError", errData =>
      reject(errData.parserError || errData)
    );
    pdfParser.on("pdfParser_dataReady", () => {
      resolve(pdfParser.getRawTextContent());
    });
    pdfParser.loadPDF(absPath);
  });
}

/* ---------- CSV Parsing Helper ---------- */
function parseCSVFile(absPath) {
  const fileContent = fs.readFileSync(absPath, "utf8");
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });
  if (!records.length) return null;

  const first = records[0];

  // Map: lowercase -> original key
  const keyMap = Object.keys(first).reduce((acc, key) => {
    acc[key.toLowerCase()] = key;
    return acc;
  }, {});

  function pickKey(possible) {
    for (const cand of possible) {
      const lower = cand.toLowerCase();
      if (keyMap[lower]) return keyMap[lower];
    }
    return null;
  }

  const dateKey = pickKey(["date", "transaction date", "posted date"]);
  const sourceKey = pickKey(["source", "merchant", "description", "payee", "vendor"]);
  const categoryKey = pickKey(["category", "type"]);
  const amountKey = pickKey(["amount", "value", "debit", "credit"]);
  const methodKey = pickKey(["method", "payment", "account", "card"]);
  const notesKey = pickKey(["notes", "memo", "details"]);

  const amountRaw = amountKey ? String(first[amountKey]) : null;

  return {
    Date: dateKey ? first[dateKey] : null,
    Source: sourceKey ? first[sourceKey] : null,
    Category: categoryKey ? first[categoryKey] : null,
    Amount: amountRaw
      ? parseFloat(amountRaw.replace(/[^0-9.-]/g, ""))
      : null,
    Method: methodKey ? first[methodKey] : null,
    Notes: notesKey ? first[notesKey] : JSON.stringify(first).slice(0, 120),
    Type: "expense",
  };
}

/* ---------- Key-Value Text Parsing ---------- */
function parseKeyValueText(text) {
  const result = {};
  const lines = text.split(/\n| {2,}/);

  let notesStarted = false;
  const notesContent = [];

  for (let line of lines) {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();

    if (key && rest.length > 0) {
      const lowerKey = key.trim().toLowerCase();
      switch (lowerKey) {
        case "date":
          result.Date = value;
          break;
        case "source":
          result.Source = value;
          break;
        case "category":
          result.Category = value;
          break;
        case "amount":
          result.Amount = parseFloat(value.replace(/[^0-9.-]/g, "")) || null;
          break;
        case "method":
        case "payment":
          result.Method = value;
          break;
        case "type":
          if (/income/i.test(value)) result.Type = "income";
          else result.Type = "expense";
          break;
        case "notes":
        case "memo":
        case "details":
          notesStarted = true;
          notesContent.push(value);
          break;
      }
    } else if (notesStarted) {
      // multiline notes continuation
      notesContent.push(line.trim());
    }
  }

  if (notesContent.length > 0) {
    result.Notes = notesContent.join(" ").slice(0, 500);
  }

  // Fallbacks
  if (!result.Method) result.Method = extractMethod(text);
  if (!result.Notes) result.Notes = extractNotes(text);

  return result;
}

/* ---------- Regex Extraction Helpers ---------- */
function extractDate(text) {
  const match = text.match(
    /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/
  );
  if (match) {
    const d = new Date(match[1]);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

function extractAmount(text) {
  const match = text.match(/\$?\s?([0-9]+(?:[.,][0-9]{2}))/);
  return match ? parseFloat(match[1].replace(",", "")) : null;
}

function extractSource(text) {
  const lines = text.split(/\n| {2,}/).map(l => l.trim());
  for (const line of lines) {
    if (
      !/receipt|invoice|total|amount|subtotal|thank/i.test(line) &&
      line.length > 2 &&
      !/\d/.test(line)
    ) {
      return line.split(/[:-]/)[0].trim();
    }
  }
  return null;
}

function extractCategory(text) {
  const categories = {
    food: ["restaurant", "cafe", "coffee", "mcdonald", "food", "starbucks"],
    travel: ["uber", "lyft", "flight", "airlines", "hotel", "taxi"],
    shopping: ["amazon", "store", "walmart", "target", "mall"],
    entertainment: ["movie", "cinema", "concert", "spotify", "netflix"],
    bills: ["electric", "water", "internet", "rent", "bill"],
  };

  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(w => lower.includes(w))) return cat;
  }
  return "other";
}

function extractMethod(text) {
  const lower = text.toLowerCase();
  if (lower.includes("credit")) return "Credit Card";
  if (lower.includes("debit")) return "Debit Card";
  if (lower.includes("cash")) return "Cash";
  if (/(venmo|paypal|zelle)/i.test(lower)) return "Digital Wallet";
  return null;
}

function extractNotes(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 120) + (cleaned.length > 120 ? "..." : "");
}

module.exports = { parseFile };
