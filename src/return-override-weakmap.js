class Superclass {
  constructor(key) {
    return key;
  }
}

const makeSubclass = () => {
  return class Subclass extends Superclass {
    #value
    constructor(key, value) {
      super(key);
      this.#value = value;
    }
    /**
     * @param {any} key
     * @returns {key is Subclass}
     */
    static has(key) {
      try {
        key.#value;
        return true;
      } catch {
        return false;
      }
    }
    /**
     * @param {Subclass} key
     */
    static get(key) {
      try {
        return key.#value;
      } catch {
        return undefined;
      }
    }
    /**
     * @param {Subclass} key
     * @param {any} value
     */
    static set(key, value) {
      new Subclass(key, value);
    }
  };
}

/**
 * A `WeakMap`-like abstraction built using the `class` syntax and its support
 * for the return-override-mistake. This simple form of the technique cannot
 * implement the `delete` method.
 *
 * Because the browser global `windowProxy` object is exempt from the
 * return-override-mistake by special dispensation, currently, that object
 * alone cannot be used as a key in a `WeakishMap`.
 *
 * @template {object} K
 * @template {object} V
 */
export class WeakishMap {
  #klass
  constructor() {
    this.#klass = makeSubclass();
  }
  /**
   * @param {any} key
   * @returns {key is K}
   */
  has(key) {
    return this.#klass.has(key);
  }
  /**
   * @param {K} key
   * @returns {V}
   */
  get(key) {
    return this.#klass.get(key);
  }
  /**
   * @param {K} key
   * @param {V} value
   */
  set(key, value) {
    this.#klass.set(key, value);
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
