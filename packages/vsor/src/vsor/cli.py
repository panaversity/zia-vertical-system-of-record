"""The vsor command. v0 verbs: init (implemented — specs/vsor/init), dev, build, serve.

`init` is dispatched to vsor.scaffold BEFORE argparse ever sees its arguments: argparse
rejects unknown positionals with exit 2, while the init contract owes exit 1 with the
`error: bad-name` slug. The other verbs go through argparse unchanged.

Nothing here imports domain packages at module scope — composition happens inside each verb,
on demand, the same shape as upstream's gateway roots. Nothing may import THIS module
(enforced by the workspace boundary test): the CLI is the top of the graph, never a library.
"""

import argparse
import sys

from vsor import __version__

_VERBS = ("init", "dev", "build", "serve")


def main(argv: list[str] | None = None) -> int:
    arg_list = sys.argv[1:] if argv is None else argv
    if arg_list and arg_list[0] == "init":
        from vsor.scaffold import run_init

        return run_init(arg_list[1:])

    parser = argparse.ArgumentParser(
        prog="vsor",
        description="Compile a folder of governed markdown into a website and an MCP server.",
    )
    parser.add_argument("--version", action="version", version=f"vsor {__version__}")
    sub = parser.add_subparsers(dest="verb")
    for verb in _VERBS:
        sub.add_parser(verb)

    args = parser.parse_args(arg_list)
    if args.verb is None:
        parser.print_help()
        return 0

    # Every verb's contract lives in specs/ before its implementation lands here.
    print(
        f"vsor {verb_status(args.verb)}",
        file=sys.stderr,
    )
    return 2


def verb_status(verb: str) -> str:
    return (
        f"{verb}: not implemented in this build. "
        f"The contract is specs/vsor/{verb}/spec.md; "
        "current state is docs/status.md."
    )


if __name__ == "__main__":
    raise SystemExit(main())
