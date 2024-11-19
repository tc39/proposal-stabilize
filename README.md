# proposal: Stabilize, and other integrity traits

Champions:
- Mark S. Miller, Agoric
- Peter Hoddie, Moddable
- Richard Gibson, Agoric
- Chip Morningstar, MetaMask

Stage 0

## Motivating Problems

JavaScript currently supports three integrity "levels": _frozen_, _sealed_, and _non-extensible. These are a tremendous help for defensive programming, but are not strong enough for several purposes. This proposal will investigate extensions to this integrity taxonomy.

The hazards to defensive programming we wish to address include
- The ***return-override mistake***, where classes can "add" new private field to pre-existing frozen objects. This impedes fixed-shape representation of [structs and shared structs](https://github.com/tc39/proposal-structs), and provides weakmap-like functionality reachable by syntax, which therefore cannot be easily virtualized.
- The ***assignment-override mistake***, where an inherited non-writable property cannot be overridden on an inheriting object by simple property assignment. This has been the biggest deterrent to the use of `Object.freeze` for defensive programming. In particular, leaving the shared primordials unfrozen makes supply-chain poisoning attacks unstoppable. Current mitigations "work" but are too expensive.
- ***Proxy reentrancy hazards***, preventing safe handling of allegedly plain-data-like objects. The old [Records and Tuples](https://github.com/tc39/proposal-record-tuple) proposal introduced plain-data-like container values which could be safely accessed without intervealing with code attached to the value.
