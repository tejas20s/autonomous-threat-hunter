#!/usr/bin/env python3
"""Fix the .env file formatting."""

content = r"""# SOC Platform - Environment Configuration
# Fill in your values below. This file is gitignored.

# --- JWT Authentication ---
JWT_SECRET_KEY=a9f8c7b6e5d4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f

# --- Default Admin Account ---
DEFAULT_ADMIN_PASSWORD=Tejas@2584
DEFAULT_ADMIN_NAME=Tejas Solanki

# --- SMTP (optional) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=tejas927solanki@gmail.com
SMTP_PASSWORD=dvga uodv brlb hpzn
SMTP_FROM=tejas927solanki@gmail.com
"""

with open(".env", "w") as f:
    f.write(content)
print("✅ .env fixed!")
print()
with open(".env") as f:
    for i, line in enumerate(f, 1):
        print(f"{i:>3}: {line}", end="")
