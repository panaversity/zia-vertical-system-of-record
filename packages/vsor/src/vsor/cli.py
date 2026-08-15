"""The vsor command. v0 verbs: init (specs/vsor/init), dev and build (specs/vsor/build) —
serve remains an honest exit-2 stub pointing at its spec.

`init` is dispatched to vsor.scaffold BEFORE argparse ever sees its arguments: argparse
rejects unknown positionals with exit 2, while the init contract owes exit 1 with the
`error: bad-name` slug. The other verbs go through argparse; their failures raise
CommandError, printed here as `error: <slug>` on the first stderr line with the prose
remedy below — the closed set in vsor/errors.py.

Nothing here imports domain packages at module scope — composition happens inside each verb,
on demand, the same shape as upstream's gateway roots. Nothing may import THIS module
(enforced by the workspace boundary test): the CLI is the top of the graph, never a library.
"""

import argparse
import sys

from vsor import __version__
from vsor.errors import CommandError, io_refusal

# One line per verb, because a wheel is the only documentation a user is guaranteed to
# have (found live 2026-08-14: `vsor --help` listed `{init,dev,build,serve}` and nothing
# else, and `vsor build --help` listed no flags at all — a stranger with the package and
# no network could not learn what any verb does or where its output goes).
_VERBS = {
    "init": "scaffold a project into a directory of your own (run `vsor init --help`)",
    "dev": "serve the site locally on 127.0.0.1, hot-reloading from knowledge/",
    "build": "write build/ — the deployable static site — and the build.lock.json record",
    "serve": "the MCP surface for AI assistants — not in this release",
}


def _refuse(err: CommandError) -> int:
    """The refusal shape every verb owes: `error: <slug>` as the FIRST stderr line, the
    prose remedy below it, and the slug's own exit code."""
    sys.stderr.write(f"error: {err.slug}\n{err}\n")
    return err.exit_code


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
    sub = parser.add_subparsers(dest="verb", metavar="<verb>")
    for verb, summary in _VERBS.items():
        verb_parser = sub.add_parser(verb, help=summary, description=summary)
        if verb == "dev":
            # A string on purpose: the range check belongs to validate_port, whose
            # refusal is exit 1 `error: bad-port` — never argparse's exit-2 usage error.
            verb_parser.add_argument(
                "--port",
                default="3000",
                help="the port to listen on, 1024-65535 (default: 3000)",
            )
        if verb == "build":
            verb_parser.epilog = (
                "Output: build/ at the project root (replaced atomically), and "
                "build.lock.json beside it. Both paths are fixed in this release."
            )

    args = parser.parse_args(arg_list)
    if args.verb is None:
        parser.print_help()
        return 0

    try:
        if args.verb == "build":
            from vsor.build_cmd import run_build

            return run_build()
        if args.verb == "dev":
            from vsor.dev_cmd import run_dev

            return run_dev(port_raw=args.port)
    except CommandError as err:
        return _refuse(err)
    except OSError as exc:
        # The environment's last-resort boundary. These verbs write into the project for
        # their whole run — the runtime shell, the staging tree, the swap, the record —
        # and any of it can be refused by the machine; the measured case is the disk
        # filling mid-build (2026-08-15). Without this the OSError escaped as a raw
        # traceback: no slug on the first stderr line for an agent to branch on, and
        # Python's exit 1, which in this vocabulary means "your input was wrong".
        # scaffold.run_init has had the same boundary since 2026-08-13 (a chmod-555
        # target died with a traceback there too); this is the site verbs' half.
        # found live 2026-08-15: with the project root chmod 555, `vsor build` refuses at
        # the swap and `vsor dev` at materialization — both exit 3, both naming the exact
        # path the OS refused, and the committed build.lock.json is byte-identical after.
        return _refuse(io_refusal(f"vsor {args.verb}", exc))

    # Every remaining verb's contract lives in specs/ before its implementation lands here.
    print(
        f"vsor {verb_status(args.verb)}",
        file=sys.stderr,
    )
    return 2


def verb_status(verb: str) -> str:
    """The honest refusal for a verb this release does not implement.

    It names only paths that EXIST where the reader is standing. It used to point at
    `specs/vsor/<verb>/spec.md` and `docs/status.md` — found live 2026-08-14: neither is
    in the wheel, neither is in a scaffolded project, and `specs/vsor/serve/spec.md` has
    not been written at all. The repo's own detail-pass rule is that every printed path
    is real, so this names the scaffold's own command table and the release notes."""
    return (
        f"{verb}: not implemented in this build — it arrives in a later release. "
        f"What this release does implement is the command table in your project's "
        f"AGENTS.md ({', '.join(v for v in _VERBS if v != verb)}); what is in the "
        f"release is the framework's CHANGELOG.md."
    )


if __name__ == "__main__":
    raise SystemExit(main())
