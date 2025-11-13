import sys
import pandas as pd
import numpy as np
from tensorflow.keras.models import load_model
from sklearn.metrics import accuracy_score, classification_report

def load_csv(path, name="file"):
    try:
        df = pd.read_csv(path)
        print(f"✅ Loaded {name}: {path} -> shape {df.shape}")
        return df
    except FileNotFoundError:
        print(f"❌ File not found: {path}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error loading {name} ({path}): {e}")
        sys.exit(1)

def prepare_y_true(y_df):
    # y_df might be a Series or a DataFrame
    if isinstance(y_df, pd.Series):
        return y_df.values.flatten()
    # DataFrame with single column
    if y_df.shape[1] == 1:
        return y_df.iloc[:, 0].values.flatten()
    # One-hot / multi-column -> convert to class indices
    return np.argmax(y_df.values, axis=1)

def predict_classes(y_pred, threshold=0.5):
    """
    Robust conversion of model outputs to class indices:
    - If y_pred is 1D -> treat as binary probabilities
    - If y_pred has shape (n,1) -> binary probability column
    - Else -> multiclass probabilities -> argmax
    """
    y_pred = np.asarray(y_pred)
    if y_pred.ndim == 1:
        # e.g., model.predict produced shape (n,)
        return (y_pred > threshold).astype(int)
    if y_pred.ndim == 2 and y_pred.shape[1] == 1:
        return (y_pred.flatten() > threshold).astype(int)
    # multiclass
    return np.argmax(y_pred, axis=1)

def main():
    print("🔹 Loading test data...")
    X_test = load_csv("X_test.csv", name="X_test")
    y_test = load_csv("y_test.csv", name="y_test")

    # Convert X_test to numpy; ensure correct shape for model
    X_test_vals = X_test.values
    print(f"✅ X_test numpy shape: {X_test_vals.shape}")

    print("🔹 Loading model...")
    try:
        model = load_model("chess_model.keras")
        print("✅ Model loaded successfully.")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        sys.exit(1)

    print("🔹 Making predictions...")
    try:
        y_pred = model.predict(X_test_vals)
    except Exception as e:
        print(f"❌ Prediction failed: {e}")
        sys.exit(1)

    print(f"🔸 Raw prediction shape: {np.asarray(y_pred).shape}")

    # Prepare true labels and predicted classes robustly
    y_true = prepare_y_true(y_test)
    y_pred_classes = predict_classes(y_pred)

    # sanity check lengths
    if len(y_true) != len(y_pred_classes):
        print("❌ Length mismatch between y_true and y_pred_classes:",
              len(y_true), "vs", len(y_pred_classes))
        sys.exit(1)

    print("🔹 Evaluating performance...")
    acc = accuracy_score(y_true, y_pred_classes)
    print(f"Accuracy: {acc:.4f}\n")
    print("Classification Report:\n", classification_report(y_true, y_pred_classes))

if __name__ == "__main__":
    main()
