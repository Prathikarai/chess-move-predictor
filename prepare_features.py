# prepare_features.py
"""
Prepares data for the deep learning model:
- Selects key columns
- Encodes categorical labels
- Scales numerical features
- Saves processed files
"""

import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
import os

def prepare_features(train_file='train.csv', test_file='test.csv'):
    try:
        # Check if files exist
        if not os.path.exists(train_file) or not os.path.exists(test_file):
            raise FileNotFoundError("train.csv or test.csv not found. Run split_dataset.py first.")

        # Load data
        train_df = pd.read_csv(train_file)
        test_df = pd.read_csv(test_file)
        print("✅ Training and testing datasets loaded successfully.")

        # Select important columns (you can add more later)
        selected_features = ['white_rating', 'black_rating', 'turns']
        target = 'winner'

        # Drop missing targets
        train_df = train_df.dropna(subset=[target])
        test_df = test_df.dropna(subset=[target])

        # Separate features and labels
        X_train = train_df[selected_features]
        y_train = train_df[target]
        X_test = test_df[selected_features]
        y_test = test_df[target]

        # Encode target labels
        le = LabelEncoder()
        y_train = le.fit_transform(y_train)
        y_test = le.transform(y_test)

        # Scale numeric data
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        # Save processed datasets
        pd.DataFrame(X_train_scaled, columns=selected_features).to_csv('X_train.csv', index=False)
        pd.DataFrame(X_test_scaled, columns=selected_features).to_csv('X_test.csv', index=False)
        pd.DataFrame({'winner': y_train}).to_csv('y_train.csv', index=False)
        pd.DataFrame({'winner': y_test}).to_csv('y_test.csv', index=False)

        print("💾 Feature-prepared files saved: X_train.csv, X_test.csv, y_train.csv, y_test.csv")

    except FileNotFoundError as e:
        print(f"❌ {e}")
    except Exception as e:
        print(f"⚠️ Unexpected error: {e}")

if __name__ == "__main__":
    prepare_features()
