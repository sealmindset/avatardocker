# Compatibility shim for typeguard
# LiteAvatar uses typeguard 2.x API (check_argument_types)
# This provides compatibility with both typeguard 2.x and 3.x

try:
    # Try typeguard 2.x API first
    from typeguard import check_argument_types
except ImportError:
    # Typeguard 3.x removed check_argument_types
    # Provide a no-op replacement
    def check_argument_types():
        """No-op replacement for typeguard 2.x check_argument_types"""
        return True
