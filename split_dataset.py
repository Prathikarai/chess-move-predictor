# split_dataset.py
"""
This script splits the preprocessed dataset (games_clean.csv)
into training and testing sets for model training.
"""

import pandas as pd
from sklearn.model_selection import train_test_split
import os

def split_dataset(file_path='games_clean.csv', test_ratio=0.2):
    try:
        # ✅ Check if file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"{file_path} not found. Please check the file path.")

        # ✅ Load dataset
        df = pd.read_csv(file_path)
        print(f"✅ Dataset loaded successfully! Shape: {df.shape}")

        # ✅ Split dataset
        train, test = train_test_split(df, test_size=test_ratio, random_state=42)
        print(f"📊 Training set: {train.shape}, Testing set: {test.shape}")

        # ✅ Save results
        train.to_csv('train.csv', index=False)
        test.to_csv('test.csv', index=False)

        print("💾 train.csv and test.csv saved successfully in the project folder!")

    except FileNotFoundError as e:
        print(f"❌ {e}")
    except pd.errors.EmptyDataError:
        print("⚠️ Error: The file is empty.")
    except Exception as e:
        print(f"⚠️ Unexpected error: {e}")

if __name__ == "__main__":
    split_dataset()
