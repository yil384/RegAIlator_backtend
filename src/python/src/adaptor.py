import pandas as pd
from io import StringIO

# Column names for the compliance output spreadsheet
COLUMNS = [
    "Date",
    "Vendor",
    "Product name",
    "Product part number",
    "Regulation or substance name",
    "Compliant conclusion\n(Compliant, not compliant, not applicable or unclear)",
    "Compliant conclusion justification",
    "Disclosures of the substances",
    "CAS number",
    "Concentration (wt%)",
    "Concentration (ppm)",
]


def from_general_template_to_xlsx(template, output_path):
    """Convert JSON template string to an Excel file with standardized columns."""
    data = pd.read_json(StringIO(template)).data

    # Extract only the required columns from each record
    df_list = [{col: item[col] for col in COLUMNS} for item in data]

    df = pd.DataFrame(df_list, columns=COLUMNS)
    df.to_excel(output_path, index=False, engine='openpyxl')
