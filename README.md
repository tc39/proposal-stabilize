# proposal-stabilize

Proposal for tc39 of new integrity distinctions for mitigating
- The assignment-override-mistake
- The return-override-mistake
- Proxy reentrancy hazards

## Background

Standard JavaScript has three unpleasant but unsuppressible features that we'd like to find some way to suppress or evade.

### The assignment-override-mistake.

Say we have an object `y` that inherits the `foo` property from ancestor object `x`. When `x.foo` is writable, assigning `y.foo = value` will create a new own `foo` property on `y` that *overrides* the `foo` property that `y` had inherited from `x`. The assignment-override-mistake (often referred to simply as the "override-mistake") is that if `x.foo` was a non-writable data property, `y.foo = value` will throw rather than creating a new own property on `y`.

To provide a JavaScript system with better overall integrity, several frameworks including Hardened JS transitively freeze all the intrinsic objects (also known as the "primordial objects"), which are all the objects that must exist before code starts running. The main impediment to adopting such frameworks is the assignment-override-mistake, as code written to override properties by assignment fail when the object the overridden property is inherited from has been frozen. Hardened JS and others suppress this problem to some degree, but with a solution (involving conversion to accessor properties) that is too expensive for pervasive use.

After extensive investigation, AFAIK no one has ever observed non-test code in the wild that intentionally makes use of the override-mistake. Thus, we still hope that it could simply be fixed language-wide without breaking the web. If this turns out to be possible, we would vastly prefer that over this proposal's approach to locally suppress it. However, experiments to date did run into an accidental dependency, that still makes web breakage hard to evaluate (TODO links needed). Hence the inclusion within this proposal.

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

To this table, we propose to add two new integrity distinctions, which unfortunately would also turn this full order into a partial order. Our placeholder names are "stable" and "vitrified", which are certainly subject to change. Better name suggestions appreciated!

By "explicit", we mean that the distinction is fundamental semantic state. An object implementation must directly represent whether an object is extensible. By "emergent", we mean that the integrity is implied by the coincidence of several conditions. An object is sealed iff it is non-extensible and all its own properties are non-configurable.
The existing integrity distinctions are often referred to as "integrity levels" because they are fully ordered. "non-extensible" is implied by "sealed", which is implied by "frozen". Because our proposal does not fit within a full ordering, we use "integrity distinctions" instead. Each of these integrity distinctions is a one-way switch. Once an object is, for example, sealed, it must be forever sealed.

## Problem statement

There are various useful restrictions that, in retrospect, some of us wish frozen objects had followed. However, that ship has sailed, so we wish to introduce new frozen-like integrity distinctions that provide those useful restrictions. The restrictions we're currently considering:
- Evade the assignment-override-mistake.
- Evade the return-override-mistake.
- Evade proxy reentrancy hazards.



## Proposal

| level          | cause               | test           | kind
|----------------|---------------------|----------------|---------
| stable         | `stabilize`         | `isStable`     | explicit
| vitrified      | `vitrify`           | `isVitrified`  | emergent

Where "virtified" is the emergent integrity distinction of being both "frozen" and "stable".

A stable object would be exempt from the return-override mistake, which is to say, classes cannot use return-override to "add" extra internal fields to such objects. Thus, stability can be seen as a stronger form of non-extensibility. It would see pleasant to have stability imply (be stronger than) non-extensibility. Every stable object would then also be a non-extensible object. However, this bundling is not essential to this proposal.

A vitrified would be exempt from the assignment-override mistake, which is to say that an object that inherits a non-writable data property from a vitrified object can override it with assignment. Because the assignment-override mistake applies only to inherited non-writable data properties, it makes sense to attach it to the vitrified state. But this is not essential to this proposal. It could apply instead to all stable objects, affecting only the inheritance of their (currently) non-writable data properties.

If and only if a proxy's (shadow) target is a vitrified object, then the proxy itself is vitrified. In this case, no operations on the proxy trap to the handler. Rather, the handler is ignored (and could even be collected) and the proxy acts in all ways like its vitrified target, except that it has a distinct object identity. Thus, once an object has passed the `isVitrified` test and is seen to only have own data properties, then we know that its own properties can be touched without interleaving any code from the object's provider. We need to add a corresponding constraint to the object invariants, so an exotic vitrified object also cannot observably interleave any behavior or mutation during access to its own data properties.

Originally we had only a single additional integrity distinction, where the new integrity distinction implied "frozen". In this sense, it was an explicit integrity distinction equivalent to the "vitrified". However, one of the main motivations is to allow the structs of the [structs-proposal](https://github.com/tc39/proposal-structs) to be cheaply implemented in existing engines using a fixed sized layout for all instances of the same struct declaration. If the fields of structs (or possibly even shared structs) appear to be public own writable data properties, then they cannot be frozen. Thus, without splitting the new integrity distinction into two, we cannot enable structs to avoid shape-change from return-override.

Similarly, the current JS spec has a special case that exempts the browser global object (the so-called "WindowProxy" object, which is not a proxy) from the return-override mistake. Since this peculiar object must be exempt even when it is unfrozen, we could not retroactively rationalize it in terms of the new integrity distinction without the same split.
