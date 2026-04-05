"""Routers package — exposes all domain routers."""
from .auth import router as auth_router
from .users import router as users_router
from .policies import router as policies_router
from .claims import router as claims_router
from .simulate import router as simulate_router
from .admin import router as admin_router

__all__ = [
    "auth_router",
    "users_router",
    "policies_router",
    "claims_router",
    "simulate_router",
    "admin_router",
]
