"use strict";
let CurrentReaction = void 0;
let CurrentGets = null;
let CurrentGetsIndex = 0;
let EffectQueue = [];
export const CacheClean = 0;
export const CacheCheck = 1;
export const CacheDirty = 2;
export function reactive(fnOrValue) {
  return new Reactive(fnOrValue);
}
function defaultEquality(a, b) {
  return a === b;
}
export class Reactive {
  _value;
  fn;
  observers = null;
  // nodes that have us as sources (down links)
  sources = null;
  // sources in reference order, not deduplicated (up links)
  state;
  effect;
  cleanups = [];
  equals = defaultEquality;
  constructor(fnOrValue, effect) {
    if (typeof fnOrValue === "function") {
      this.fn = fnOrValue;
      this._value = void 0;
      this.effect = effect || false;
      this.state = CacheDirty;
      if (effect)
        this.update();
    } else {
      this.fn = void 0;
      this._value = fnOrValue;
      this.state = CacheClean;
      this.effect = false;
    }
  }
  get value() {
    return this.get();
  }
  set value(v) {
    this.set(v);
  }
  get() {
    if (CurrentReaction) {
      if (!CurrentGets && CurrentReaction.sources && CurrentReaction.sources[CurrentGetsIndex] == this) {
        CurrentGetsIndex++;
      } else {
        if (!CurrentGets)
          CurrentGets = [this];
        else
          CurrentGets.push(this);
      }
    }
    if (this.fn)
      this.updateIfNecessary();
    return this._value;
  }
  set(fnOrValue) {
    if (typeof fnOrValue === "function") {
      const fn = fnOrValue;
      if (fn !== this.fn)
        this.stale(CacheDirty);
      this.fn = fn;
    } else {
      if (this.fn) {
        this.removeParentObservers(0);
        this.sources = null;
        this.fn = void 0;
      }
      const value = fnOrValue;
      if (!this.equals(this._value, value)) {
        if (this.observers) {
          for (let i = 0; i < this.observers.length; i++) {
            this.observers[i].stale(CacheDirty);
          }
        }
        this._value = value;
      }
    }
  }
  stale(state) {
    if (this.state < state) {
      if (this.state === CacheClean && this.effect)
        EffectQueue.push(this);
      this.state = state;
      if (this.observers) {
        for (let i = 0; i < this.observers.length; i++) {
          this.observers[i].stale(CacheCheck);
        }
      }
    }
  }
  /** run the computation fn, updating the cached value */
  update() {
    const oldValue = this._value;
    const prevReaction = CurrentReaction;
    const prevGets = CurrentGets;
    const prevIndex = CurrentGetsIndex;
    CurrentReaction = this;
    CurrentGets = null;
    CurrentGetsIndex = 0;
    try {
      if (this.cleanups.length) {
        this.cleanups.forEach((c) => c(this._value));
        this.cleanups = [];
      }
      this._value = this.fn();
      if (CurrentGets) {
        this.removeParentObservers(CurrentGetsIndex);
        if (this.sources && CurrentGetsIndex > 0) {
          this.sources.length = CurrentGetsIndex + CurrentGets.length;
          for (let i = 0; i < CurrentGets.length; i++) {
            this.sources[CurrentGetsIndex + i] = CurrentGets[i];
          }
        } else {
          this.sources = CurrentGets;
        }
        for (let i = CurrentGetsIndex; i < this.sources.length; i++) {
          const source = this.sources[i];
          if (!source.observers) {
            source.observers = [this];
          } else {
            source.observers.push(this);
          }
        }
      } else if (this.sources && CurrentGetsIndex < this.sources.length) {
        this.removeParentObservers(CurrentGetsIndex);
        this.sources.length = CurrentGetsIndex;
      }
    } finally {
      CurrentGets = prevGets;
      CurrentReaction = prevReaction;
      CurrentGetsIndex = prevIndex;
    }
    if (!this.equals(oldValue, this._value) && this.observers) {
      for (let i = 0; i < this.observers.length; i++) {
        this.observers[i].state = CacheDirty;
      }
    }
    this.state = CacheClean;
  }
  /** update() if dirty, or a parent turns out to be dirty. */
  updateIfNecessary() {
    if (this.state === CacheCheck) {
      for (const source of this.sources) {
        source.updateIfNecessary();
        if (this.state === CacheDirty) {
          break;
        }
      }
    }
    if (this.state === CacheDirty) {
      this.update();
    }
    this.state = CacheClean;
  }
  removeParentObservers(index) {
    if (!this.sources)
      return;
    for (let i = index; i < this.sources.length; i++) {
      const source = this.sources[i];
      const swap = source.observers.findIndex((v) => v === this);
      source.observers[swap] = source.observers[source.observers.length - 1];
      source.observers.pop();
    }
  }
}
export function onCleanup(fn) {
  if (CurrentReaction) {
    CurrentReaction.cleanups.push(fn);
  } else {
    console.error("onCleanup must be called from within a @reactive function");
  }
}
export function stabilize() {
  for (let i = 0; i < EffectQueue.length; i++) {
    EffectQueue[i].get();
  }
  EffectQueue.length = 0;
}
