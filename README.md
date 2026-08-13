# vsor

Repo: `zia-vertical-system-of-record-framework` · PyPI package and binary: `vsor` · Apache-2.0

`vsor` will be a command-line tool for anyone who owns a body of professional knowledge — an
accountant, a lawyer, a teacher. You put your material in a folder as markdown files and run one
command. It validates the files, splits them into passages, computes embeddings, and loads them into
Postgres. From that content it runs two things: **a static website people browse**, and **an MCP
server AI assistants query**. Every answer names its source file and the numbered content version it
came from. When nothing in your files matches closely enough, the server says the material does not
cover the question instead of answering from the model's own knowledge.

> ## ⚠️ Pre-release: no verb is implemented yet
>
> The workspace, CI gate, boundary guards and fixture corpus exist and run (`make gate`). The four
> verbs are honest stubs — each exits 2 and points at its spec in `specs/`. The hard half already
> runs in production upstream; the work is to join and extract, not to invent.

```
knowledge/*.md   instance.md                            ← you write these
                       │
                  vsor build                             validate · chunk · embed
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   build.lock.json   Postgres      build/
   (committed)       rows under    static site
                     a generation
                          │              │
                          ▼              ▼
                    MCP server       a website
                    agents query     people browse
```

**It is not an agent framework.** It is the knowledge layer such frameworks read *from*.

Your project stays yours and stays simple — markdown and one config file, no toolchain. When you (or
your coding agent) want to customize deeper, `vsor eject <component>` puts the actual source in your
repo, recorded in the build so a modified build is distinguishable from a stock one.

Start with **[AGENTS.md](AGENTS.md)** (how this is built), then **[docs/status.md](docs/status.md)**
(where things stand this week), then **[docs/extraction.md](docs/extraction.md)** (the work list for
the join).
