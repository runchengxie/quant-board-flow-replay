"""Build a new replay bundle from an explicit archive path."""

import argparse
import json
from pathlib import Path

from board_flow_replay.build import build


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    command = commands.add_parser("build", help="Read an archive and create a new offline bundle")
    command.add_argument("--archive", type=Path, required=True)
    command.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = build(args.archive, args.out)
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"Build failed: {error}\n")
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
