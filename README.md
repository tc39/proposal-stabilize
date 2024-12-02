# proposal: Stabilize, and other integrity traits

Better support for high integrity programming by extending the existing system of integrity "levels".

Proposal for tc39 of new integrity "traits" for mitigating
- The assignment-override-mistake
- The return-override-mistake
- Proxy reentrancy hazards


## Status

**Stage**: 0

Co-champions:
- Mark S. Miller (@erights)
- Chip Morningstar (@fudco)
- Richard Gibson (@gibson042)
- Mathieu Hofman (@mhofman)

## Presentation history

- ***for stage 1*** - November 2024 structs working group ([slides.key](./stabilize-talks/stabilize-stage1-as-recorded-at-structs-group.key), [slides.pdf](./stabilize-talks/stabilize-stage1-as-presented-at-structs-group.pdf), [video](https://www.youtube.com/watch?v=VHr4Jvvt0vc))
- ***for stage 1*** - December 2024 tc39 plenary ([slides.key](./stabilize-talks/stabilize-stage1.key), [slides.pdf](./stabilize-talks/stabilize-stage1.pdf), [docs slides](https://docs.google.com/presentation/d/1474EreKln5bErl-pMUUq2PnX5LRo2Z93jxxGBNbZmco/edit?usp=sharing))

## Background

JavaScript currently has three integrity levels, *frozen*, *sealed*. and *non-extensible*. These are "levels" because they are currently in a fully-ordered hierarchy: All frozen objects are sealed, and all sealed objects are non-extensible. These are "integrity" levels because they support high integrity programming.

For example, [Hardened JS](https://hardenedjs.org/) and several other systems `freeze` the *primordial objects*, i.e., those built-in intrinsic objects that exist before code starts running. This supports higher integrity programming by, for example, preventing prototype poisoning, a major source of supply-chain vulnerability.

However, even for frozen objects, standard JavaScript has three unpleasant issues that we'd like to mitigate.

### The assignment-override-mistake.

```js
Object.freeze(Object.prototype);

function Point(x, y) {
  this.x = y; this.y = y;
}

Point.prototype.toString =
  function () {
    return `<${this.x},${this.y}>`;
  };
```

Leaving aside the `Object.freeze` on the first statement, there is a tremendous amount of legacy code on the web resembling the second two statements, where `Point` is a class-like constructor `function` whose instances inherit a `toString` method from `Point.prototype`. In this common legacy pattern, this `toString` method is defined by ***assignment*** to `Point.prototype`, to ***override*** the `Object.prototype.toString`, which the instances would otherwise have inherited.

However, in an environment in which `Object.prototype` is naive frozen, as in the first statement above, due to the assignment-override-mistake, the assignment in the third statement fails. In strict code it fails with a thrown exception. Even worse, in sloppy code, it fails silently, with the code then proceeding to misbehave. The assignment-override-mistake is that an inherited non-writable data property, such as the `Object.prototype.toString` property after the `freeze` cannot be overriden by assignment to an inheriting object, such as `Point.prototype`.

The ses-shim implementation of Hardened JS works around this problem for a limited set of primordial properties by first turning them into accessor properties whose setter emulates what the behavior of such an assignment would be had tc39 not made the assignment-override-mistake. However, we only do this for limited set because this technique is expensive, awkward, and non-transparent.

With this limited workaround, a tremendous amount of existing JavaScript code written with no awareness of Hardened JS nevertheless runs under Hardened JS compatibly. However, the vast majority of existing code that fails to run under Hardened JS fails because of the override mistake. Other systems that freeze the primordials report similar incompatibility. Some systems have given up on freezing primordials, and the resulting integrity benefits, due to these compatibility costs. Indeed, we find that ***the assignment override mistake is the greatest deterrence to higher integrity programming in JavaScript***.

After extensive investigation, we do not know of ***any*** non-test production code that intentionally makes use of the assignment-override-mistake. Thus, we still hope that it could simply be fixed language-wide without breaking the web. If this turns out to be possible, we would vastly prefer that over this proposal's approach to locally mitigate it, explained below. However, experiments to date did run into an accidental dependency, that still makes web breakage hard to evaluate (TODO links needed). This caused tc39 to back out of an earlier attempt to fix it language-wide. Hence the inclusion within this proposal.

### The return-override-mistake

```js
class Superclass {
  constructor(key) { return key; }
}

class Subclass extends Superclass {
  #value
  constructor(key, value) {
    super(key);
    this.#value = value;
  }
}

new Subclass(freeze(Object.prototype), 'a'); // private field added to primordial
```

The `Superclass` constructor above ends with an explict `return` statement. This has the peculiar effect that the subclass then treats this explicitly returned object as if it is an instance of the `Subclass`. In particular, in the subclass constructor the `super(key);` statement calls the `Superclass` constructor which returns `key`. The `Subclass` constructor then binds it to `this` and initializes it with a private `#value` field. This happens even if the `key` is a preexisting frozen object. The JavaScript spec explains this semantics as-if there is a hidden `WeakMap` within each such class definition. Indeed, [return-override-weakmap.js](./src/return-override-weakmap.js), which uses this technique to implement a `WeakMap`-like abstraction.

```js
new Subclass(struct, 'a'); // unpleasant shape change
```

This has several unpleasant consequences. All browser JavaScript implementations that we know of implements the addition of such internal fields by shape change of the object, much like their implementation of the addition of public properties. In v8, for example, both would involve change the object's so-called *hidden class*, which is internal bookkeeping for keeping track of objects with common shapes.

An engineering goals of [structs and shared structs](https://tc39.es/proposal-structs/) is that all instances of the same (class-like) struct definition have the same statically-knowable shape, enabling compilation of struct methods into higher speed code. However, this would conflict with uses of return override as above, with a struct as key, since the addition of the private field would cause a shape change. In theory this could be fixed in such engines at a cost in additional implementation complexity. This is a cost no one wants to pay to support a "feature" that likely no one wants to actually use anyway.

```js
harden(Subclass); // transitive `freeze`. Is `Subclass` pure?
const obj = freeze({}); // `obj` is clearly pure
new Subclass(obj, 'a'); // private field added to frozen object
```

In a confinement scenario, where Alice, Bob, and Carol are three programs, if Alice runs first, loads Bob and Carol in separately confined compartments, where they share only pure objects, i.e., objects with no mutable state, Bob and Carol should not be able to use these pure objects to communicate. We certainly want to consider a simple prozen object like `freeze({})` to be pure. If a class is transitively frozen, i.e., if the class and all objects transitively reachable from it by property and inheritance walk are frozen, and the code of the class has not lexically captured anything mutable, then we'd like, for purposes of security analysis, to consider such a class to be pure. Indeed, the purity predicate built into the Moddable XS implementation does consider both of these to be pure.

But because of the return-override-mistake, Bob and Carol could communicate given only such a pair. Where is the mutability enabling this communications? The only possible answer today is that the hidden weakmap within the subclass implementation is the source of mutability. Any subclass that declares a private field and inherits from a superclass that *might* engage in return-override to provide a pre-existing object would need to be considered impure. But this would break the alignment in Moddable XS between purity and the ability to store such classes in ROM. It would mean that a module that exports only such classes would itself need to be considered impure, even if it could not in practice enable communications. This inhibits sharing of such effectively-pure modules between programs, such as Bob and Carol, that should not be able to communicate.

```js
new Subclass(representative, 'a'); // makes gc of virtual objects observable
```

The Agoric platform provides the abstraction mechanisms for defining virtual objects, a kind of virtual memory for objects, where the number of such objects can vastly exceed what can pratically be stored in the JavaScript engine's in-memory heap. Like pages in a virtual memory system, such objects are primarily represented in longer term external storage and "paged in" on demand. In the analogy, the equivalent of a paged-in physical page is a *representative* -- a regular JavaScript object that represents the virtual object, and continues to represent it as long as it is not collected by the language engine's garbage collector. When such a representative is collected, the virtual object still exists in external storage, to be paged back in on demand.

To maintain the illusion that all these objects are as-if in the language's heap, we need to be careful about object identity, as tested for example by `===`. For `===` specifically, it suffices to ensure that a virtual object never has more that one representative alive at a time. Although each representative has a unique identity at the JavaScript implementation level, `===` can never compare two representatives of the same virtual object because it can only compare objects it retains simultaneously during the comparison. Likewise for object identity comparisons by `Object.is`, `Map`, and `Set`. In particular, a `Map` retains its keys, so a representative used as a key in a `Map` will not be collected.

The problem arises when a representative is weakly held. There are three mechanisms in JavaScript by which objects can be weakly held:
- `WeakRef` and `FinalizationRegistry`. Our virtual object system reserves these to itself, and does not provide even a virtualization of these to programs running within the virtual object system.
- `WeakMap` and `WeakSet`. If the real `WeakMap` constructor was available to programs running in the virtual object system, a representative as a key could be collected, dropping the association to some value. If the virtual object gets paged back in, the new representative will not be found in that WeakMap, breaking the illusion.

    To uphold the illusion, on initialization, our virtual object system reserves the real `WeakMap` and `WeakSet` constructors to itself, but provide substitute *virtualization-aware* `WeakMap` and `WeakSet` constructors. For non-representative keys, these pass through to the hidden real `WeakMap` and `WeakSet`. For representatives, it collaborates with the virtual object storage system to act as if the virtual object is the key, preserving the association past the lifetime of any one representative.
- The return-override-mistake, which makes weakmap-like functionality ***reachable by syntax***, and therefore not pratically virtualizable. If return-override is used with a virtual-object representative as key, the installed private field will observably disappear whenever the representative happens to be colleected, to be succeeded by a new representative. Virtualizing this hidden weakmap-like functionality would instead necessitate a painful rewrite to remove all class private fields from the target language. This is too costly to be practical.

```js
new Subclass(window, 'a'); // fails only on browser global `windowProxy` object
```

Due to the way browsers implement the browser global `windowProxy` object, it would be painful for them to support the addition of private fields demanded by the return-override-mistake. Instead, as a special dispensation, the browser global `windowProxy` object specifically is exempt from this requirement.

Such a special exemption is an awkward complexity for a language spec, violates the principle of least surpise, and makes it impractical to perfectly emulate the browser global `windowProxy` object using any other object, including the global object of a constructed realm or compartment.

### Proxy Reentrancy Hazards

```js
function foo(suspect) {
  if (!recordLike(freeze(suspect)))
    throw Error(...);
  // ... suspend invariant ...
  ... suspect.bar ...
  // ... restore invariant ...
}

foo(new Proxy({ bar: 3 }), {
  get() { foo({}); }
});
```



---
just raw material below this line
---

### Retcon `windowProxy`, `Object.prototype`

```js
> Object.setPrototypeOf(window, {});
// Uncaught TypeError: Immutable prototype object
// ‘#<Window>' cannot have their prototype set

> Object.setPrototypeOf(Object.prototype, {});
// Uncaught TypeError: Immutable prototype object
// ‘Object.prototype' cannot have their prototype set
```

### Remaining unbundling

```js
preventNewProperties(foo);
Object.setPrototype(foo, {}); // ok
Object.defineProperty(foo, 'bar', {...}); // throws
```

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
