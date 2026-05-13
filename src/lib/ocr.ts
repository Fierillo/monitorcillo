import Tesseract from 'tesseract.js';

export async function extractTextFromImage(imageUrl: string, language = 'spa'): Promise<string> {
    const result = await Tesseract.recognize(imageUrl, language, {
        logger: () => {}
    });
    return result.data.text;
}
