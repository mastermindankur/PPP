import pandas as pd
import sys

try:
    # Attempt to read the Excel file
    xls = pd.ExcelFile("ppp_data.xls")
    if "Data" not in xls.sheet_names:
        print("Error: 'Data' sheet not found in the Excel file.", file=sys.stderr)
        sys.exit(1)

    df = xls.parse("Data")
    # Save to CSV
    df.to_csv("ppp_data.csv", index=False)
    print("Conversion successful: ppp_data.xls to ppp_data.csv")

except ImportError:
    print("Error: pandas library is not installed. Please install it using 'pip install pandas'.", file=sys.stderr)
    sys.exit(1)
except FileNotFoundError:
    print("Error: ppp_data.xls not found.", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"An unexpected error occurred: {e}", file=sys.stderr)
    sys.exit(1)