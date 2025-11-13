# train_model.py
"""
Trains a deep learning model to predict the outcome of a chess game
based on player ratings and number of turns, with class weighting for imbalanced classes.
"""

import pandas as pd
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, Input
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.metrics import accuracy_score, classification_report
from sklearn.utils.class_weight import compute_class_weight
import numpy as np
import os

def train_chess_model():
    try:
        # ✅ Check if prepared data exists
        for file in ['X_train.csv', 'X_test.csv', 'y_train.csv', 'y_test.csv']:
            if not os.path.exists(file):
                raise FileNotFoundError(f"{file} not found. Please run prepare_features.py first.")

        # ✅ Load data
        X_train = pd.read_csv('X_train.csv')
        X_test = pd.read_csv('X_test.csv')
        y_train = pd.read_csv('y_train.csv').values.ravel()
        y_test = pd.read_csv('y_test.csv').values.ravel()

        print("✅ Data loaded successfully for training.")

        # Determine number of classes dynamically
        num_classes = len(np.unique(y_train))
        print(f"🔢 Number of classes: {num_classes}")

        # ✅ Compute class weights to handle imbalanced dataset
        class_weights = compute_class_weight(
            class_weight='balanced',
            classes=np.unique(y_train),
            y=y_train
        )
        class_weights = dict(enumerate(class_weights))
        print(f"⚖ Class weights: {class_weights}")

        # ✅ Build the Neural Network with proper Input() layer
        model = Sequential([
            Input(shape=(X_train.shape[1],)),
            Dense(64, activation='relu'),
            Dropout(0.3),
            Dense(32, activation='relu'),
            Dense(num_classes, activation='softmax')  # Multiclass output
        ])

        # ✅ Compile the model for multiclass classification
        model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',  # Correct for integer labels
            metrics=['accuracy']
        )

        model.summary()

        # ✅ Early stopping to prevent overfitting
        early_stop = EarlyStopping(
            monitor='val_loss',
            patience=3,
            restore_best_weights=True
        )

        # ✅ Train the model with class weights
        history = model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=20,
            batch_size=32,
            callbacks=[early_stop],
            class_weight=class_weights,
            verbose=1
        )

        # ✅ Evaluate the model
        y_pred = np.argmax(model.predict(X_test), axis=1)
        acc = accuracy_score(y_test, y_pred)
        print(f"\n🎯 Model Accuracy: {acc * 100:.2f}%")
        print("\n📊 Classification Report:\n", classification_report(y_test, y_pred, zero_division=0))

        # ✅ Save the trained model
        model.save('chess_model.keras')
        print("💾 Model saved as chess_model.keras")

    except FileNotFoundError as e:
        print(f"❌ {e}")
    except Exception as e:
        print(f"⚠ Unexpected error: {e}")

if __name__ == "__main__":
    train_chess_model()
