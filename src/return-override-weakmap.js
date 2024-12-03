class Trojan {
  constructor(key) {
    return key;
  }
}

const makePrivateTagger = () => {
  const tombstone = Symbol('deleted');
  return class PrivateTagger extends Trojan {
    #value
    constructor(key, value) {
      super(key);
      this.#value = value;
    }
    /**
     * @param {any} key
     * @returns {boolean}
     */
    static has(key) {
      try {
        return key.#value !== tombstone;
      } catch {
        return false;
      }
    }
    /**
     * @param {PrivateTagger} key
     */
    static get(key) {
      try {
        const value = key.#value;
        return value === tombstone ? undefined : value;
      } catch {
        return undefined;
      }
    }
    /**
     * @param {PrivateTagger} key
     * @param {any} value
     */
    static set(key, value) {
      new PrivateTagger(key, value);
    }
    /**
     * @param {PrivateTagger} key
     */
    static delete(key) {
      try {
        key.#value = tombstone;
      } catch {}
    }
  };
}

/**
 * A `WeakMap`-like abstraction built using the `class` syntax and its support
 * for the return-override-mistake.
 *
 * Because the browser global WindowProxy object is exempt from the
 * return-override-mistake by special dispensation, currently, that object
 * alone cannot be used as a key in a `WeakishMap`.
 *
 * @template {object} K
 * @template {object} V
 */
export class WeakishMap {
  #tagger
  constructor() {
    this.#tagger = makePrivateTagger();
  }
  /**
   * @param {any} key
   * @returns {boolean}
   */
  has(key) {
    return this.#tagger.has(key);
  }
  /**
   * @param {K} key
   * @returns {V}
   */
  get(key) {
    return this.#tagger.get(key);
  }
  /**
   * @param {K} key
   * @param {V} value
   */
  set(key, value) {
    this.#tagger.set(key, value);
  }
  /**
   * @param {K} key
   */
  delete(key) {
    return this.#tagger.delete(key);
  }
}

Object.freeze(Object.prototype);

function Point(x, y) {
  this.x = y; this.y = y;
}

Point.prototype.toString =
  function () {
    return `<${this.x},${this.y}`;
  };
