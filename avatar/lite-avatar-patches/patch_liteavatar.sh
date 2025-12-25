#!/bin/bash
# Patch LiteAvatar to work with newer numpy and typeguard versions

set -e

LITE_AVATAR_DIR="/app/lite-avatar"

echo "Patching LiteAvatar for numpy/typeguard compatibility..."

# 1. Replace typeguard imports with compatibility shim
# Copy the compatibility module
cp /app/patches/typeguard_compat.py "$LITE_AVATAR_DIR/typeguard_compat.py"

# 2. Patch extract_paraformer_feature.py to use the compatibility shim
sed -i 's/from typeguard import check_argument_types/from typeguard_compat import check_argument_types/' \
    "$LITE_AVATAR_DIR/extract_paraformer_feature.py"

# 3. Patch any funasr_local files that use typeguard
find "$LITE_AVATAR_DIR/funasr_local" -name "*.py" -type f -exec \
    sed -i 's/from typeguard import check_argument_types/from typeguard_compat import check_argument_types/' {} \;

# 4. Add typeguard_compat to funasr_local for relative imports
cp /app/patches/typeguard_compat.py "$LITE_AVATAR_DIR/funasr_local/typeguard_compat.py"

# 5. Fix any numpy compatibility issues
# numpy.float is deprecated, use float or numpy.float64
find "$LITE_AVATAR_DIR" -name "*.py" -type f -exec \
    sed -i 's/np\.float\b/np.float64/g' {} \;
find "$LITE_AVATAR_DIR" -name "*.py" -type f -exec \
    sed -i 's/np\.int\b/np.int64/g' {} \;
find "$LITE_AVATAR_DIR" -name "*.py" -type f -exec \
    sed -i 's/np\.bool\b/np.bool_/g' {} \;
find "$LITE_AVATAR_DIR" -name "*.py" -type f -exec \
    sed -i 's/np\.str\b/np.str_/g' {} \;
find "$LITE_AVATAR_DIR" -name "*.py" -type f -exec \
    sed -i 's/np\.object\b/np.object_/g' {} \;

echo "LiteAvatar patching complete!"
