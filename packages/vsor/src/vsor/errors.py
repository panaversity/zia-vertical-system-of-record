"""The closed failure vocabulary of the site verbs (specs/vsor/build, "Failure honesty").

Exit 1 is the user's input speaking; exit 3 is the environment speaking. The CLI prints
``error: <slug>`` as the FIRST stderr line, with the prose remedy below — agents branch on
the slug, humans read the prose. The set is closed: a new failure mode is a spec change,
never a new string invented at the raise site.
"""

import errno
from types import MappingProxyType

SLUG_EXITS: MappingProxyType[str, int] = MappingProxyType(
    {
        # exit 1 — the user's input speaking
        "build-failed": 1,
        "instance-invalid": 1,
        "bad-port": 1,
        "port-in-use": 1,
        "dev-failed": 1,
        # Two more the input can be wrong about, added 2026-08-15 (see site_runtime):
        # another vsor already working in this project, and a corpus whose documents are
        # symbolic links — bytes the site would serve and build.lock.json could not name.
        "project-busy": 1,
        "symlink-unsupported": 1,
        # A corpus document whose effective-dating keys vsor cannot act on — the one that
        # matters is a `superseded_by` naming a document this build is not publishing
        # (see knowledge.py). Exit 1, beside `instance-invalid`: it is the user's markdown
        # speaking, and the fix is a line in a file they wrote.
        "knowledge-invalid": 1,
        # exit 3 — the environment speaking
        "missing-runtime": 3,
        "install-failed": 3,
        "build-crashed": 3,
        "io-failed": 3,
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


# ── io-failed: the filesystem refusing vsor's own work ──────────────────────────────────
#
# Added 2026-08-15, from the lock-record audit. The site verbs write into the project the
# whole time they run — the runtime shell, the staging tree, the swap, the record — and
# every one of those calls can be refused by the machine. Before this slug existed the
# OSError escaped `run_build` / `run_dev` as a raw traceback: no first-line slug for an
# agent to branch on, and Python's own exit code (1), which in this vocabulary means
# "your input was wrong". It is exit 3 for the same reason `missing-runtime` is: the
# environment is speaking, and no edit to the corpus changes the answer.
#
# The remedy is chosen by errno because the common four want four different actions, and
# an error whose remedy is generic is an error the reader has to diagnose themselves.
# (The disk filling is the measured case: it happened on this machine on 2026-08-15.)
_IO_REMEDIES: MappingProxyType[int, str] = MappingProxyType(
    {
        errno.ENOSPC: (
            "The filesystem holding this project is full. Free some space — `.vsor/` is "
            "scratch and safe to delete (it costs a re-install, never work) — then rerun."
        ),
        errno.EDQUOT: (
            "You are over your filesystem quota. Free some space — `.vsor/` is scratch and "
            "safe to delete (it costs a re-install, never work) — or raise the quota, then rerun."
        ),
        errno.EACCES: (
            "vsor cannot write there. Fix that path's permissions, or run vsor from a "
            "directory you own, then rerun."
        ),
        errno.EPERM: (
            "vsor cannot write there. Fix that path's permissions, or run vsor from a "
            "directory you own, then rerun."
        ),
        errno.EROFS: (
            "That filesystem is mounted read-only. Remount it writable, or copy the project "
            "somewhere writable, then rerun."
        ),
        errno.ENOENT: (
            "Something vsor expected is no longer there. If the path is under `.vsor/`, delete "
            "that directory and rerun — it is scratch and re-materializes; otherwise restore "
            "the file it names."
        ),
    }
)

_IO_DEFAULT_REMEDY = (
    "The operating system refused it; the reason above is its own, untranslated. Check the "
    "path it names — permissions, free space, and whether it still exists — then rerun."
)


def io_refusal(operation: str, exc: OSError, *, note: str | None = None) -> CommandError:
    """Map an OSError from vsor's own filesystem work onto ``io-failed``.

    ``operation`` is what vsor was doing, in the user's vocabulary ("writing
    <path>/build.lock.json"), so the message never makes the reader guess which of a
    verb's many writes failed. ``note`` carries what is still true afterwards — the one
    thing only the raising call site knows.
    """
    reason = exc.strerror or str(exc) or exc.__class__.__name__
    # `filename2` is the DESTINATION of a two-path call and it is the one that is usually
    # wrong: `os.replace(tmp, path)` onto a directory raises EISDIR with the *source* in
    # `filename`, so the message named a temp file that was fine and sent the reader to
    # the wrong path entirely (found live 2026-08-15). Both are printed when both exist,
    # because "which end" is exactly the question the reader has.
    where = ""
    if exc.filename and getattr(exc, "filename2", None):
        where = f" ({exc.filename} -> {exc.filename2})"
    elif exc.filename or getattr(exc, "filename2", None):
        where = f" ({exc.filename or exc.filename2})"
    remedy = _IO_REMEDIES.get(exc.errno, _IO_DEFAULT_REMEDY) if exc.errno else _IO_DEFAULT_REMEDY
    prose = f"{operation} failed: {reason}{where}.\n{remedy}"
    if note is not None:
        prose = f"{prose}\n{note}"
    return CommandError("io-failed", prose)
