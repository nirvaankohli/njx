from __future__ import annotations


class DocShieldError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFoundError(DocShieldError):
    def __init__(self, message: str):
        super().__init__(message, status_code=404)


class ConflictError(DocShieldError):
    def __init__(self, message: str):
        super().__init__(message, status_code=409)

