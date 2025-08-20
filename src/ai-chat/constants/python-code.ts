export const excelExploreCode = (excelFilePath: string) => {
  const pythonCode = `import pandas as pd
import requests
import json

def analyze_excel_file(url):
    try:
        # Download the Excel file
        response = requests.get(url)
        response.raise_for_status()

        # Read Excel file with all sheets
        excel_file = pd.ExcelFile(response.content)

        analysis_result = {
            "file_info": {
                "total_sheets": len(excel_file.sheet_names),
                "sheet_names": excel_file.sheet_names
            },
            "sheets_analysis": {}
        }

        # Analyze each sheet
        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(response.content, sheet_name=sheet_name)

            # Basic sheet information
            sheet_info = {
                "dimensions": {
                    "rows": len(df),
                    "columns": len(df.columns)
                },
                "columns": {
                    "names": df.columns.tolist(),
                    "data_types": df.dtypes.astype(str).to_dict()
                },
                "sample_data": df.head(5).to_dict('records'),
                "statistics": {}
            }

            # Generate statistics for numeric columns
            numeric_columns = df.select_dtypes(include=['number']).columns
            if len(numeric_columns) > 0:
                sheet_info["statistics"]["numeric"] = df[numeric_columns].describe().to_dict()

            # Generate statistics for categorical columns
            categorical_columns = df.select_dtypes(include=['object']).columns
            if len(categorical_columns) > 0:
                sheet_info["statistics"]["categorical"] = {}
                for col in categorical_columns:
                    sheet_info["statistics"]["categorical"][col] = {
                        "unique_values": int(df[col].nunique()),
                        "most_common": df[col].value_counts().head(5).to_dict(),
                        "null_count": int(df[col].isnull().sum())
                    }

            # Check for missing values
            sheet_info["missing_data"] = {
                "total_missing": int(df.isnull().sum().sum()),
                "missing_by_column": df.isnull().sum().to_dict()
            }

            analysis_result["sheets_analysis"][sheet_name] = sheet_info

        return json.dumps(analysis_result, indent=2, ensure_ascii=False)

    except Exception as e:
        return f"Error analyzing Excel file: {str(e)}"

url = "${excelFilePath}"
result = analyze_excel_file(url)
print(result)`;

  return pythonCode;
};
