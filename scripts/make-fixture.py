"""Create invented archive data and a replay outside the source checkout."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from board_flow_replay.build import build  # noqa: E402
from tests.fixtures import archive  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--archive", type=Path, required=True)
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
if any(target.resolve().is_relative_to(root) for target in [args.archive, args.out]):
    parser.error("fixture data and output must be outside the source checkout")
archive(args.archive)
print(build(args.archive, args.out))
