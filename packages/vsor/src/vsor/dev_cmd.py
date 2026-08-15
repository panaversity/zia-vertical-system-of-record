"""`vsor dev` — specs/vsor/build. The Docusaurus dev server on 127.0.0.1 only, serving the
runtime shell (the forked app — see site_runtime) and hot-reloading from the authored
`knowledge/` and `site/` through the copies inside it, which `sync_authored` mirrors every
half second while the server runs.

The process contract, exactly: the child runs in its own process group
(start_new_session=True) with stdin closed — no prompt can ever reach it; SIGINT/SIGTERM
forward to the whole group; after `vsor dev` exits nothing listens on its port and no
descendant survives (the group gets a final SIGKILL sweep). Ctrl-C is a decided exit 0.
The port is pre-bound (SO_REUSEADDR probe, closed before spawn): occupied is a refusal,
never a prompt, never a silent auto-increment — an agent that printed "localhost:3000"
must not be wrong.

**dev does not warn about the placeholder `url`, and that is decided, not an omission**
(2026-08-14). `vsor build` warns when the site it just emitted carries a placeholder origin
(`build_cmd._warn_placeholder_url`). Here the same condition is *correct*: the site really is
at http://127.0.0.1:<port>, the dev server emits no sitemap, no canonical link and no JSON-LD
— nothing carries an origin off this machine — and this verb runs dozens of times a day. A
warning on every dev start would be a warning about nothing, printed so often that the one on
`vsor build`, where it names a real defect in a real artifact, gets read as noise. One warning,
on the verb that produces the thing you upload.
"""

import contextlib
import os
import signal
import socket
import subprocess
import time
from pathlib import Path
from types import FrameType

from vsor import site_runtime
from vsor.errors import CommandError
from vsor.instance import Instance, InstanceError, parse_instance

DEFAULT_PORT = "3000"


def validate_port(raw: str) -> int:
    """Integer 1–65535, else `bad-port` naming --port — never argparse's exit-2 usage error."""
    try:
        port = int(raw, 10)
    except ValueError:
        port = -1
    if not 1 <= port <= 65535:
        raise CommandError(
            "bad-port",
            f"{raw!r} is not a usable port — pass --port an integer between 1 and 65535 "
            "(the default is 3000).",
        )
    return port


def port_is_free(port: int) -> bool:
    """The pre-bind probe on 127.0.0.1: SO_REUSEADDR so a just-closed dev server's
    TIME_WAIT socket never blocks an immediate restart; closed before any spawn."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def _read_instance(project_root: Path) -> Instance:
    instance_path = project_root / "instance.md"
    try:
        return parse_instance(instance_path)
    except FileNotFoundError:
        raise CommandError(
            "instance-invalid",
            f"{instance_path} does not exist — every vsor project has one at the root. "
            "Restore it from version control, or scaffold a fresh project with `vsor init` "
            "and copy its instance.md.",
        ) from None
    except InstanceError as exc:
        raise CommandError("instance-invalid", str(exc)) from exc


_SYNC_INTERVAL_SECONDS = 0.5


# Everything that must end this verb rather than escape it. SIGINT and SIGTERM were
# forwarded from the start; SIGHUP and SIGQUIT were not, and SIGHUP is what a closed
# terminal and a torn-down agent session send. Found live 2026-08-15: `kill -HUP` on
# `vsor dev` killed vsor and left the Docusaurus server ALIVE, still holding the port,
# with `.vsor/lock` naming a dead pid — so the next verb took the lock over and rewrote
# the shell that orphan was serving from, which is the exact corruption the lock exists
# to prevent.
_FORWARDED_SIGNALS = (signal.SIGINT, signal.SIGTERM, signal.SIGHUP, signal.SIGQUIT)


def _serve(project_root: Path, runtime_dir: Path, port: int, lock_path: Path) -> int:
    """Spawn the dev server in its own process group and babysit it until a signal or
    its own death, mirroring authored edits into the shell's copies every half second
    (site_runtime.sync_authored — the copy-on-invoke fallback's hot-reload half).
    Returns the exit code for the vsor process."""
    binary = runtime_dir / "node_modules" / ".bin" / "docusaurus"
    child = subprocess.Popen(
        [str(binary), "start", ".", "--port", str(port), "--host", "127.0.0.1", "--no-open"],
        cwd=runtime_dir,
        env=site_runtime.runtime_env(),
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    # The lock names the child from here on: a killed vsor leaves this process alive and
    # serving, and the next verb must see the project as still held rather than take it
    # over and rewrite the shell underneath it.
    site_runtime.record_child(lock_path, child.pid)

    forwarded: list[int] = []

    def _forward(signum: int, _frame: FrameType | None) -> None:
        forwarded.append(signum)
        with contextlib.suppress(ProcessLookupError, PermissionError):
            os.killpg(child.pid, signum)

    previous = {number: signal.signal(number, _forward) for number in _FORWARDED_SIGNALS}
    try:
        while True:
            returncode = child.poll()
            if returncode is not None:
                break
            if not forwarded:
                with contextlib.suppress(OSError):
                    site_runtime.sync_authored(project_root, runtime_dir)
            time.sleep(_SYNC_INTERVAL_SECONDS)
    finally:
        for number, handler in previous.items():
            signal.signal(number, handler)
        # No descendant survives: a final sweep of the (now leaderless) group.
        with contextlib.suppress(ProcessLookupError, PermissionError):
            os.killpg(child.pid, signal.SIGKILL)

    if forwarded:
        return 0  # Ctrl-C / SIGTERM shutdown is a decided exit 0, never 130
    raise CommandError(
        "dev-failed",
        f"the dev server exited on its own (code {returncode}) — its output above is the "
        "cause, untranslated. Fix what it names and rerun vsor dev.",
    )


def run_dev(project_root: Path | None = None, *, port_raw: str = DEFAULT_PORT) -> int:
    root = project_root if project_root is not None else Path.cwd()

    node_version = site_runtime.probe_node_version()
    site_runtime.check_node(node_version)
    port = validate_port(port_raw)
    _read_instance(root)

    # The port check comes BEFORE materializing the runtime, deliberately. Reversed (as it was
    # until 2026-08-15) a first run spends up to two minutes installing the site runtime and only
    # then discovers it cannot bind — and, worse, ensure_runtime wipes and re-copies the corpus
    # into the shell, which is the very shell a dev server already holding this port is serving
    # from. Refusing first makes the common "I already have one running" case free and harmless.
    if not port_is_free(port):
        raise CommandError(
            "port-in-use",
            f"port {port} on 127.0.0.1 is already in use — stop whatever holds it, or pass a "
            f"different one: vsor dev --port <1-65535>.",
        )

    # Held for the WHOLE serve, not just materialization: this verb keeps writing into the
    # shell the entire time it runs (sync_authored mirrors every authored save into the
    # copies Docusaurus is watching), and a `vsor build` — or a second `vsor dev` on another
    # port — would delete and rebuild those copies underneath it. The port probe cannot see
    # that collision; the lock can. Taken after the probe, so the common "I already have one
    # running" case still gets the more specific port-in-use answer.
    with site_runtime.project_lock(root, verb="dev") as lock_path:
        runtime_dir = site_runtime.ensure_runtime(root)

        print(f"vsor dev — serving http://127.0.0.1:{port}/ (Ctrl-C stops it)", flush=True)
        return _serve(root, runtime_dir, port, lock_path)
