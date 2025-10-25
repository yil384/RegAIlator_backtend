import fitz
from pdf2image import convert_from_path
import pytesseract
import openpyxl

def extract_text_from_xlsx(xlsx_path):
    text = ''
    text_by_sheet = []

    try:
        # 加载工作簿
        wb = openpyxl.load_workbook(xlsx_path, data_only=True)
        for sheet in wb.worksheets:
            sheet_text = ''
            for row in sheet.iter_rows(values_only=True):
                row_text = ' '.join([str(cell).strip() for cell in row if cell is not None])
                if row_text:
                    sheet_text += row_text + '\n'
            # 清理空行和多余空格
            sheet_text = '\n'.join([line.strip() for line in sheet_text.split('\n') if line.strip() != ''])
            text_by_sheet.append(sheet_text)
            text += sheet_text + '\n'
    except Exception as e:
        print(f"Error reading XLSX file: {e}")
        return '', []

    # 最终返回总文本和每个sheet的文本
    return text.strip(), text_by_sheet

def extract_text_from_pdf(pdf_path):
    text = ''
    text_by_page = []
    # Open the PDF file as a document and extract text from each page
    with fitz.open(pdf_path) as doc:
        for page in doc:
            temp = page.get_text()
            # 去除空行和连续的空格
            temp = '\n'.join([line.strip() for line in temp.split('\n') if line.strip() != ''])
            text += temp
            text_by_page += [temp]

    if text == '':
        try:
            # If the text is empty, use OCR to extract text from the PDF
            images = convert_from_path(pdf_path)
            for image in images:
                temp = pytesseract.image_to_string(image)
                # 去除空行和连续的空格
                temp = '\n'.join([line.strip() for line in temp.split('\n') if line.strip() != ''])
                text += temp
                text_by_page += [temp]
        except Exception as e:
            print(f"Error converting PDF to images: {e}")
            # 根据需要返回空文本或其他默认值
            return '', []
    return text, text_by_page


if __name__ == '__main__':
    pdf_path = 'example.pdf'
    text, text_by_page = extract_text_from_pdf(pdf_path)
    print(text)
    print(text_by_page)