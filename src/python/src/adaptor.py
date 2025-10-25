import pandas as pd
from io import StringIO

def from_general_template_to_xlsx(template, output_path):
    # 将 string 格式的 JSON 数据转换为 DataFrame，提取“data”字段
    data = pd.read_json(StringIO(template)).data
    # 定义所需的列名
    columns = [
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
        "Concentration (ppm)"
    ]
    # 创建一个空的 DataFrame，用于存储所有数据
    df_list = []
    # 遍历每个字典，处理并存储数据
    for item in data:
        mapped_data = {
            "Date": item["Date"],
            "Vendor": item["Vendor"],
            "Product name": item["Product name"],
            "Product part number": item["Product part number"],
            "Regulation or substance name": item["Regulation or substance name"],
            "Compliant conclusion\n(Compliant, not compliant, not applicable or unclear)": item["Compliant conclusion\n(Compliant, not compliant, not applicable or unclear)"],
            "Compliant conclusion justification": item["Compliant conclusion justification"],
            "Disclosures of the substances": item["Disclosures of the substances"],
            "CAS number": item["CAS number"],
            "Concentration (wt%)": item["Concentration (wt%)"],
            "Concentration (ppm)": item["Concentration (ppm)"]
        }
        # 添加到 DataFrame 列表中
        df_list.append(mapped_data)

    # 将列表转换为 DataFrame
    df = pd.DataFrame(df_list, columns=columns)
    # 保存为 Excel 文件
    df.to_excel(output_path, index=False, engine='openpyxl')
    return