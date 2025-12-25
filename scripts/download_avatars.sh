#!/bin/bash
# Download all LiteAvatar models from ModelScope
# Downloads both PNG thumbnails and ZIP files for each avatar

BASE_URL="https://modelscope.cn/models/HumanAIGC-Engineering/LiteAvatarGallery/resolve/master"
TARGET_DIR="./avatar/lite-avatar/data/avatars"

# Create target directory
mkdir -p "$TARGET_DIR/20250408"

# Avatar IDs from avatarslist.md
AVATARS=(
    # Female avatars (12)
    "20250408/P1lXrpJL507-PZ4hMPutyF7A"
    "20250408/P1VXATUY6mm7CJLZ6CARKU0Q"
    "20250408/P1bywtN2wUs4zbOIctjYZpjw"
    "20250408/P11EW-z1MQ7qDBxbdFkzPPng"
    "20250408/P1tkdZGlULMxNRWB3nsrucSA"
    "20250408/P1lQSCriJLhJCbJfoOufApGw"
    "20250408/P1DB_Y1K6USuq-Nlun6Bh94A"
    "20250408/P1yerb8kIA7eBpaIydU2lwzA"
    "20250408/P1tDSmoZ2olUyEqDslDH_cnQ"
    "20250408/P1mmEbsQ19oc-16L27yA0_ew"
    "20250408/P1CgOolwJwkGaZLu3BDN6S_w"
    "20250408/P1sd8kz0dw2_2wl7m97UVjSQ"
    # Male avatars (10)
    "20250408/P1S9eH2OIYF1HgVyM2-2OK4g"
    "20250408/P1u82oEWvPea73MT96wWTK-g"
    "20250408/P1JBluxvgTS5ynI_lKtw64LQ"
    "20250408/P1j2fUp4WJH7v5NlZrEDK_nw"
    "20250408/P11eXAt1qfgYGyiJnbKy5Zow"
    "20250408/P16F_-yXUzcnhqYhWTsW310w"
    "20250408/P1HypyfUJfi6ZJawOSSN7GqA"
    "20250408/P12rUIdDyWToybp-B0DCefSQ"
    "20250408/P1PQc-xB-UC_y-Cm1D9POa8w"
    "20250408/P1dZg4pbDQ0OvEBvexPszwtw"
)

echo "Downloading ${#AVATARS[@]} avatars to $TARGET_DIR..."
echo ""

count=0
total=${#AVATARS[@]}

for avatar_id in "${AVATARS[@]}"; do
    count=$((count + 1))
    filename=$(basename "$avatar_id")
    
    echo "[$count/$total] Downloading $filename..."
    
    # Download PNG thumbnail
    echo "  -> Thumbnail: ${filename}.png"
    wget -q -c "${BASE_URL}/${avatar_id}.png" -O "${TARGET_DIR}/${avatar_id}.png" 2>/dev/null || \
    curl -s -L -C - "${BASE_URL}/${avatar_id}.png" -o "${TARGET_DIR}/${avatar_id}.png"
    
    # Download ZIP file
    echo "  -> Model: ${filename}.zip"
    wget -q -c "${BASE_URL}/${avatar_id}.zip" -O "${TARGET_DIR}/${avatar_id}.zip" 2>/dev/null || \
    curl -s -L -C - "${BASE_URL}/${avatar_id}.zip" -o "${TARGET_DIR}/${avatar_id}.zip"
    
    echo "  Done!"
    echo ""
done

echo "=========================================="
echo "Download complete!"
echo "Downloaded $total avatars to $TARGET_DIR"
echo ""
echo "Files:"
ls -lh "$TARGET_DIR/20250408/" | head -20
echo "..."
