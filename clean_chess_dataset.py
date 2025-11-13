import pandas as pd

# Load dataset
df = pd.read_csv("games.csv")

# Inspect dataset
print("Initial dataset shape:", df.shape)
print(df.head())

# Check for column names
print("Columns in dataset:", df.columns.tolist())

# Set essential columns based on actual dataset
essential_cols = ["moves"]  # we keep "moves" as essential
if "winner" in df.columns:
    essential_cols.append("winner")  # add "winner" if it exists

# Drop rows with missing essential columns
df = df.dropna(subset=essential_cols)

# Drop duplicates
df = df.drop_duplicates()

# Filter games with very few moves
df = df[df['moves'].str.split().str.len() > 4]

# Add a move_count feature
df['move_count'] = df['moves'].str.split().str.len()

# Save cleaned dataset
df.to_csv("games_clean.csv", index=False)
df.sample(500).to_csv("games_clean_sample.csv", index=False)

print("Cleaning done. Cleaned dataset saved as games_clean.csv")
