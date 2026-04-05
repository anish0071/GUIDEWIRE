"""
Standalone simulation CLI — runs trigger simulations via the backend API.

Usage:
  # From project root:
  python -m backend.scripts.simulate --phone 9876543210 --preset heavy_rain
  python -m backend.scripts.simulate --phone 9876543210 --rain 80 --traffic 15 --temp 42
  python -m backend.scripts.simulate --list-presets

This script calls the live backend API (default http://localhost:8000).
It handles login, simulation, and displays results — all from the terminal.
"""

import argparse
import json
import sys
import requests

DEFAULT_BASE = "http://localhost:8000"


def api(base, method, path, body=None):
    """Make an API request and return parsed JSON."""
    url = f"{base}{path}"
    try:
        if method == "GET":
            r = requests.get(url, timeout=30)
        else:
            r = requests.post(url, json=body, timeout=30)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to backend at {base}")
        print("   Start it with: uvicorn backend.main:app --reload --port 8000")
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print(f"❌ API error: {e}")
        try:
            print(f"   Detail: {r.json().get('detail', 'unknown')}")
        except Exception:
            pass
        sys.exit(1)


def get_or_create_user(base, phone):
    """Login via OTP flow and return user_id."""
    # Step 1: Send OTP
    res = api(base, "POST", "/auth/login", {"phone": phone})
    # Extract OTP from demo message
    msg = res.get("message", "")
    otp = ""
    if "demo OTP:" in msg:
        otp = msg.split("demo OTP:")[1].strip().rstrip(")")
    if not otp:
        print("❌ Could not extract OTP from response.")
        sys.exit(1)

    # Step 2: Verify OTP
    res = api(base, "POST", "/auth/verify-otp", {"phone": phone, "otp": otp})
    user_id = res.get("user_id")
    print(f"✅ Authenticated as user_id={user_id}")
    return user_id


def list_presets(base):
    """Print available presets."""
    presets = api(base, "GET", "/simulate/presets")
    print("\n🎭 Available Presets:")
    print("-" * 40)
    for name, signals in presets.items():
        print(f"  {name:20s} → {json.dumps(signals)}")
    print()


def run_simulation(base, user_id, signals):
    """Run a simulation and display results."""
    print(f"\n⚡ Running simulation for user_id={user_id}")
    print(f"   Signals: {json.dumps(signals)}")
    print("-" * 50)

    res = api(base, "POST", "/simulate/run", {
        "user_id": user_id,
        "signals": signals,
    })

    # Display results
    fired = res.get("fired", [])
    print(f"\n🔔 Triggers fired: {', '.join(fired) if fired else 'None'}")

    if res.get("claim_id"):
        print(f"📄 Claim #{res['claim_id']} → status: {res.get('claim_status', '?').upper()}")

    if res.get("payout_amount", 0) > 0:
        print(f"💰 Auto-payout: ₹{res['payout_amount']:.2f} credited to wallet!")

    metrics = res.get("metrics", {})
    if metrics:
        print(f"\n📊 AI Metrics:")
        print(f"   Risk:       {metrics.get('risk', 0):.0%}")
        print(f"   Confidence: {metrics.get('confidence', 0):.0%}")
        print(f"   Fraud:      {metrics.get('fraud', 0):.0%}")

    print()
    return res


def main():
    parser = argparse.ArgumentParser(
        description="Project-A Trigger Simulator CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --phone 9876543210 --preset heavy_rain
  %(prog)s --phone 9876543210 --rain 80 --traffic 15
  %(prog)s --list-presets
        """,
    )
    parser.add_argument("--base", default=DEFAULT_BASE, help="Backend URL (default: %(default)s)")
    parser.add_argument("--phone", help="Phone number for authentication")
    parser.add_argument("--list-presets", action="store_true", help="List available presets")
    parser.add_argument("--preset", help="Apply a named preset (e.g. heavy_rain)")

    # Signal overrides
    parser.add_argument("--rain", type=float, default=None, help="Rainfall in mm")
    parser.add_argument("--traffic", type=float, default=None, help="Traffic speed km/h")
    parser.add_argument("--temp", type=float, default=None, help="Temperature °C")
    parser.add_argument("--inactivity", type=float, default=None, help="Inactivity minutes")

    args = parser.parse_args()

    # Health check
    api(args.base, "GET", "/health")
    print(f"🟢 Backend is live at {args.base}")

    if args.list_presets:
        list_presets(args.base)
        return

    if not args.phone:
        parser.error("--phone is required for simulations")

    # Authenticate
    user_id = get_or_create_user(args.base, args.phone)

    # Build signals
    signals = {"rain": 10, "traffic": 60, "temp": 22, "inactivity": 60}

    # Apply preset if given
    if args.preset:
        presets = api(args.base, "GET", "/simulate/presets")
        if args.preset not in presets:
            print(f"❌ Unknown preset '{args.preset}'. Use --list-presets to see options.")
            sys.exit(1)
        signals.update(presets[args.preset])
        print(f"🎭 Applied preset: {args.preset}")

    # Apply manual overrides
    if args.rain is not None:
        signals["rain"] = args.rain
    if args.traffic is not None:
        signals["traffic"] = args.traffic
    if args.temp is not None:
        signals["temp"] = args.temp
    if args.inactivity is not None:
        signals["inactivity"] = args.inactivity

    # Run
    run_simulation(args.base, user_id, signals)


if __name__ == "__main__":
    main()
