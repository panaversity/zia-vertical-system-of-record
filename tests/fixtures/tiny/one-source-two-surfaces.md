---
title: One Source, Two Surfaces
sidebar_position: 1
description: One governed source, read by people and by AI agents — and the pattern that repeats for every profession.
---

# One Source, Two Surfaces

**One source. Two kinds of reader. A pattern that repeats for every profession.**

Everything here grows from one decision: a body of knowledge stops being a document and becomes a
*system of record*: one governed source that people and AI agents both read, and that can be
pointed at.

:::tip In plain words

A system of record is the one place the official version lives. When the ledger and a spreadsheet
disagree, the ledger wins. Businesses have had them for decades; books never did.

:::

## The two surfaces

The same source is compiled into two things, and neither is a copy of the other:

| Surface | Who reads it | What it must guarantee |
| :--- | :--- | :--- |
| The website | people | it is legible, navigable, and current |
| The MCP server | AI assistants | every answer cites its source, and says so when the corpus is silent |

Adding a surface never means editing the knowledge. That is the whole point of compiling from one
source rather than maintaining two.

## What the compiler does

```text
knowledge/*.md  ->  validate  ->  build/      the website
                             ->  Postgres     the MCP server's generation
```

## Why generic AI is not enough

An assistant with no governed source answers from everything it has ever read. It is fluent about
your domain and your competitor's, about this year's rule and last year's, and it cannot tell you
which is which. The failure is not that it is wrong often — it is that a wrong answer and a right
one arrive in exactly the same confident voice.

A system of record fixes the shape of the problem rather than the rate of the error: the assistant
answers from a finite, checked corpus, cites the document, and **abstains** when the corpus does
not cover the question.

## Check yourself

<Quiz
  title="One question on authority"
  questions={[
    {
      question: "What makes a system of record different from a well-written document?",
      options: [
        "It is longer and more detailed",
        "It is the authoritative source that other copies defer to",
        "It is written by more than one author",
        "It is published on a website",
      ],
      correctOption: 1,
      explanation:
        "Authority is the distinguishing property: when two versions disagree, the system of record is the one that wins. Length, authorship and publishing are incidental.",
      source: "One Source, Two Surfaces — The two surfaces",
    },
  ]}
/>
