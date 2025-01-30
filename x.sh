#!/bin/bash

# Check if a folder is provided
if [ -z "$1" ]; then
    echo "Usage: $0 /path/to/folder"
    exit 1
fi

# Find all SVG files containing "image/png;base64"
find "$1" -type f -name "*.svg" | while read -r svg; do
    if grep -q "image/png;base64" "$svg"; then
        # Extract Base64 PNG data
        base64_data=$(grep -oP '(?<=xlink:href="data:image/png;base64,)[^"]+' "$svg")

        if [ -n "$base64_data" ]; then
            png_file="${svg%.svg}.png"
            echo "Extracting PNG from $svg to $png_file"
            echo "$base64_data" | base64 --decode > "$png_file"
        fi
    fi
done

echo "Extraction completed."