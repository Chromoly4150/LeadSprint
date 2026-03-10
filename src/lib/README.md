# src/lib

This directory is reserved for shared application code such as:
- database access
- auth helpers
- permission checks
- domain services
- formatting utilities

The app is intended to remain a modular monolith, so shared domain logic should live here or in domain-focused subdirectories rather than inside page components.
