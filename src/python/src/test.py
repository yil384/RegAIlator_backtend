import pandas as pd

def test_accuracy(output_path, answer_path, debug=False):
    answer = pd.read_excel(answer_path, engine='openpyxl', sheet_name="Sheet1").to_json(orient='records')
    output = pd.read_excel(output_path, engine='openpyxl', sheet_name="Sheet1").to_json(orient='records')
    
    # Compare the output and answer one by one
    answer = pd.read_json(answer)
    output = pd.read_json(output)

    # 定义所需的key
    keys = [
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

    if debug:
        print("answer:", answer)
        print("-------------------")
        print("output:", output)
        print("-------------------")

    # Calculate the accuracy
    correct = 0
    total = len(answer) * len(keys)

    for i in range(min(len(answer), len(output))):
        # 对每个key都进行匹配，不区分大小写，去除空格
        for key in keys:
            # if str(answer.iloc[i][key]).lower() != str(output.iloc[i][key]).lower():
            if str(answer.iloc[i][key]).strip().lower() != str(output.iloc[i][key]).strip().lower():
                # 模糊匹配
                if str(answer.iloc[i][key]).strip().lower() in str(output.iloc[i][key]).strip().lower() or str(output.iloc[i][key]).strip().lower() in str(answer.iloc[i][key]).strip().lower():
                    correct += 1
                    continue
                if debug:
                    print("key:", key)
                    print(answer.iloc[i][key], "!=", output.iloc[i][key])
                    print("-------------------")
                continue
            else:
                correct += 1
        
    accuracy = correct / total
    return accuracy


if __name__ == '__main__':
    output_path = 'output.xlsx'
    answer_path = 'answer.xlsx'
    accuracy = test_accuracy(output_path, answer_path)
    print(f'Accuracy: {accuracy}')
    # Output: Accuracy: 0.9
    # The accuracy is 90%.
    # The output and answer are the same for 9 out of 10 records.
    