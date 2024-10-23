# proposal-stabilize
Proposal for tc39 of new integrity distinctions protecting against both override mistakes and proxy reentrancy

## Background

Standard JavaScript has three unpleasant but unsuppressible properties that we'd like to find some way to suppress.

### The assignment-override-mistake.

Say we have an object `y` that inherits the `foo` property from ancestor object `x`. When `x.foo` is writable, assigning `y.foo = value` will create a new own `foo` property on `y` that *overrides* the `foo` property that `y` had inherited from `x`. The assignment-override-mistake (often referred to simply as the "override-mistake") is that if `x.foo` was a non-writable data property, `y.foo = value` will throw rather than creating a new own property on `y`.

To provide a JavaScript system with better overall integrity, several frameworks including Hardened JS transitively freeze all the intrinsic objects (also known as the "primordial objects"), which are all the objects that must exist before code starts running. The main impediment to adopting such frameworks is the assignment-override-mistake, as code written to override properties by assignment fail when the object the overridden property is inherited from has been frozen. Hardened JS and others suppress this problem to some degree, but with a solution (involving conversion to accessor properties) that is too expensive for pervasive use.

After extensive investigation, AFAIK no one has ever observed non-test code in the wild that intentionally makes use of the override-mistake. Thus, we still hope that it could simply be fixed language-wide without breaking the web. If this turns out to be possible, we would vastly prefer that to this proposal's approach to locally suppressing it. However, experiments to date did run into an accidental dependency, that still makes web breakage hard to evaluate. Hence the inclusion within this proposal.

### The return-override-mistake

JavaScript classes have implied `WeakMap` functionality in their semantics. If
- a subclass `B` inherits from base class `A`,
- `B` declared a private field `#foo`
- `A`'s constructor returns an existing frozen object,

then during `B` phase of the object's initialization, the private field `#foo` will be added to whatever `A`'s constructor returned.

### Proxy Reentrancy Hazards


### Integrity Distinctions

EcmaScript currently has several defined object integrity distinctions, fully ordered from weakest to strongest

| level          | cause               | test           | kind
|----------------|---------------------|----------------|---------
| non-extensible | `preventExtensions` | `isExtensible` | explicit
| sealed         | `seal`              | `isSealed`     | emergent
| frozen         | `freeze`            | `isFrozen`     | emergent

To this table, we propose to add two new integrity distinctions, which unfortunately would also turn this full order into a partial order. Our placeholder names are "stable" and "petrified", which are certainly subject to change. Better name suggestions appreciated!

By "explicit", we mean that the distinction is fundamental semantic state. An object implementation must directly represent whether an object is extensible. By "emergent", we mean that the integrity is implied by the coincidence of several conditions. An object is sealed iff it is non-extensible and all its own properties are non-configurable.
The existing integrity distinctions are often referred to as "integrity levels" because they are fully ordered. "non-extensible" is implied by "sealed", which is implied by "frozen". Because our proposal does not fit within a full ordering, we use "integrity distinctions" instead. Each of these integrity distinctions is a one-way switch. Once an object is, for example, sealed, it must be forever sealed.

## Problem statement

There are various useful restrictions that, in retrospect, some of us wish frozen objects had followed. However, that ship has sailed, so we wish to introduce new frozen-like integrity distinctions that provide those useful restrictions. The restrictions we're currently considering:
- Evade the assignment-override-mistake.

## Proposal

| level          | cause               | test           | kind
|----------------|---------------------|----------------|---------
| stable         | `stabilize`         | `isStable`     | explicit
| petrified      | `petrify`           | `isPetrified`  | emergent
