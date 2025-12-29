
declare const pdfjsLib: any;
declare const mammoth: any;

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return await extractTextFromPDF(file);
    case 'docx':
      return await extractTextFromDocx(file);
    case 'txt':
      return await extractTextFromTxt(file);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return cleanText(fullText);
}

async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return cleanText(result.value);
}

async function extractTextFromTxt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(cleanText(reader.result as string));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function cleanText(text: string): string {
  return text
    .replace(/\n{2,}/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/Page\s+\d+/gi, '')
    .trim();
}

export function chunkText(text: string, size: number = 2000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let index = 0;
  
  while (index < text.length) {
    chunks.push(text.substring(index, index + size));
    index += (size - overlap);
  }
  
  return chunks;
}
