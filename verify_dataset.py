import pandas as pd

# Step 1: Load your preprocessed dataset
file_path = "games_clean.csv"  # change name if using a different file

try:
    df = pd.read_csv(file_path)

    # Step 2: Show basic info
    print("\n✅ Dataset loaded successfully!")
    print("Shape:", df.shape)
    print("\nColumns:", list(df.columns))

    # Step 3: Show sample data
    print("\n--- Sample Data (first 5 rows) ---")
    print(df.head())

    # Step 4: Check for missing values
    print("\n--- Missing Values ---")
    print(df.isnull().sum())

    # Step 5: Basic statistics
    print("\n--- Statistical Summary ---")
    print(df.describe(include='all'))

except FileNotFoundError:
    print("❌ Error: File not found! Please check the file name and location.")
except pd.errors.EmptyDataError:
    print("❌ Error: The file is empty.")
except Exception as e:
    print(f"⚠️ Unexpected error: {e}")