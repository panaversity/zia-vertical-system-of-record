"""The closed failure vocabulary of the site verbs (specs/vsor/build, "Failure honesty").

Exit 1 is the user's input speaking; exit 3 is the environment speaking. The CLI prints
``error: <slug>`` as the FIRST stderr line, with the prose remedy below — agents branch on
the slug, humans read the prose. The set is closed: a new failure mode is a spec change,
never a new string invented at the raise site.
"""

from types import MappingProxyType

SLUG_EXITS: MappingProxyType[str, int] = MappingProxyType(
    {
        # exit 1 — the user's input speaking
        "build-failed": 1,
        "instance-invalid": 1,
        "bad-port": 1,
        "port-in-use": 1,
        "dev-failed": 1,
        # exit 3 — the environment speaking
        "missing-runtime": 3,
        "install-failed": 3,
        "build-crashed": 3,
    }
)


class CommandError(Exception):
    """A verb refusing with a slug from the closed set; ``str(err)`` is the prose remedy."""

    def __init__(self, slug: str, message: str) -> None:
        if slug not in SLUG_EXITS:
            raise ValueError(f"unknown error slug {slug!r} — the set in vsor/errors.py is closed")
        super().__init__(message)
        self.slug = slug
        self.exit_code = SLUG_EXITS[slug]
