import pandas as pd
import matplotlib.pyplot as plt

# Load your label file
y_train = pd.read_csv("y_train.csv")  # change name if needed

# Handle single-column vs one-hot label formats
if y_train.shape[1] == 1:
    print("🔹 Class distribution:")
    print(y_train.value_counts().sort_index())

    # Plot
    y_train.value_counts().sort_index().plot(kind='bar', color='skyblue', rot=0)
    plt.title("Class Distribution")
    plt.xlabel("Class")
    plt.ylabel("Count")
    plt.show()

else:
    class_indices = y_train.idxmax(axis=1)
    print("🔹 Class distribution (one-hot encoded):")
    print(class_indices.value_counts().sort_index())

    class_indices.value_counts().sort_index().plot(kind='bar', color='orange', rot=0)
    plt.title("Class Distribution (One-Hot)")
    plt.xlabel("Class")
    plt.ylabel("Count")
    plt.show()
