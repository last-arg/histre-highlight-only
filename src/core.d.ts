/**
 * Nodes for constructing a reactive graph of reactive values and reactive computations.
 * The graph is acyclic.
 * The user inputs new values into the graph by calling set() on one more more reactive nodes.
 * The user retrieves computed results from the graph by calling get() on one or more reactive nodes.
 * The library is responsible for running any necessary reactive computations so that get() is
 * up to date with all prior set() calls anywhere in the graph.
 *
 * We call input nodes 'roots' and the output nodes 'leaves' of the graph here in discussion,
 * but the distinction is based on the use of the graph, all nodes have the same internal structure.
 * Changes flow from roots to leaves. It would be effective but inefficient to immediately propagate
 * all changes from a root through the graph to descendant leaves. Instead we defer change
 * most change progogation computation until a leaf is accessed. This allows us to coalesce computations
 * and skip altogether recalculating unused sections of the graph.
 *
 * Each reactive node tracks its sources and its observers (observers are other
 * elements that have this node as a source). Source and observer links are updated automatically
 * as observer reactive computations re-evaluate and call get() on their sources.
 *
 * Each node stores a cache state to support the change propogation algorithm: 'clean', 'check', or 'dirty'
 * In general, execution proceeds in three passes:
 *  1. set() propogates changes down the graph to the leaves
 *     direct children are marked as dirty and their deeper descendants marked as check
 *     (no reactive computations are evaluated)
 *  2. get() requests that parent nodes updateIfNecessary(), which proceeds recursively up the tree
 *     to decide whether the node is clean (parents unchanged) or dirty (parents changed)
 *  3. updateIfNecessary() evaluates the reactive computation if the node is dirty
 *     (the computations are executed in root to leaf order)
 */
/** reactive nodes are marked dirty when their source values change TBD*/
export declare const CacheClean = 0;
export declare const CacheCheck = 1;
export declare const CacheDirty = 2;
export type CacheState = typeof CacheClean | typeof CacheCheck | typeof CacheDirty;
/** A reactive element contains a mutable value that can be observed by other reactive elements.
 *
 * The property can be modified externally by calling set().
 *
 * Reactive elements may also contain a 0-ary function body that produces a new value using
 * values from other reactive elements.
 *
 * Dependencies on other elements are captured dynamically as the 'reactive' function body executes.
 *
 * The reactive function is re-evaluated when any of its dependencies change, and the result is
 * cached.
 */
export declare function reactive<T>(fnOrValue: T | (() => T)): Reactive<T>;
declare function defaultEquality(a: any, b: any): boolean;
/** A reactive element contains a mutable value that can be observed by other reactive elements.
 *
 * The property can be modified externally by calling set().
 *
 * Reactive elements may also contain a 0-ary function body that produces a new value using
 * values from other reactive elements.
 *
 * Dependencies on other elements are captured dynamically as the 'reactive' function body executes.
 *
 * The reactive function is re-evaluated when any of its dependencies change, and the result is
 * cached.
 */
export declare class Reactive<T> {
    private _value;
    private fn?;
    private observers;
    private sources;
    private state;
    private effect;
    cleanups: ((oldValue: T) => void)[];
    equals: typeof defaultEquality;
    constructor(fnOrValue: (() => T) | T, effect?: boolean);
    get value(): T;
    set value(v: T);
    get(): T;
    set(fnOrValue: T | (() => T)): void;
    private stale;
    /** run the computation fn, updating the cached value */
    private update;
    /** update() if dirty, or a parent turns out to be dirty. */
    private updateIfNecessary;
    private removeParentObservers;
}
export declare function onCleanup<T = any>(fn: (oldValue: T) => void): void;
/** run all non-clean effect nodes */
export declare function stabilize(): void;
export {};
