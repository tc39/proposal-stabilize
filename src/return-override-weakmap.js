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
     */
    static set(key) {
      new Subclass(key);
    }
  };
}

export class WeakishMap {
  #klass
  constructor() {
    this.#klass = makeSubclass();
  }
  has(key) {
    return this.#klass.has(key);
  }
  get(key) {
    return this.#klass.get(key);
  }
  set(key) {
    this.#klass.set(key);
  }
}
