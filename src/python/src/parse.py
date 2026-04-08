import fitz
from pdf2image import convert_from_path
import pytesseract
import openpyxl


def _clean_text(raw_text):
    """Remove blank lines and excess whitespace from extracted text."""
    return '\n'.join(line.strip() for line in raw_text.split('\n') if line.strip())


def extract_text_from_xlsx(xlsx_path):
    """Extract text from all sheets in an XLSX file.

    Returns:
        tuple: (full_text, list_of_per_sheet_text)
    """
    text = ''
    text_by_sheet = []

    try:
        wb = openpyxl.load_workbook(xlsx_path, data_only=True)
        for sheet in wb.worksheets:
            sheet_text = ''
            for row in sheet.iter_rows(values_only=True):
                row_text = ' '.join(str(cell).strip() for cell in row if cell is not None)
                if row_text:
                    sheet_text += row_text + '\n'
            sheet_text = _clean_text(sheet_text)
            text_by_sheet.append(sheet_text)
            text += sheet_text + '\n'
    except Exception as e:
        print(f"Error reading XLSX file: {e}")
        return '', []

    return text.strip(), text_by_sheet


def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file. Falls back to OCR if no text layer exists.

    Returns:
        tuple: (full_text, list_of_per_page_text)
    """
    text = ''
    text_by_page = []

    # Try extracting embedded text first
    with fitz.open(pdf_path) as doc:
        for page in doc:
            page_text = _clean_text(page.get_text())
            text += page_text
            text_by_page.append(page_text)

    # Fall back to OCR if no embedded text found
    if not text:
        try:
            images = convert_from_path(pdf_path)
            for image in images:
                page_text = _clean_text(pytesseract.image_to_string(image))
                text += page_text
                text_by_page.append(page_text)
        except Exception as e:
            print(f"Error converting PDF to images: {e}")
            return '', []

    return text, text_by_page


if __name__ == '__main__':
    pdf_path = 'example.pdf'
    result_text, result_by_page = extract_text_from_pdf(pdf_path)
    print(result_text)
    print(result_by_page)
